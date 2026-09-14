package library_test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library"
)

// legitimateTransitions is the state machine docs/domain.md draws, arrow by
// arrow. The two arrows out of the start node are not here: creating an entry
// is the entry point into the lifecycle, not a transition, and the contract
// accepts all six statuses there.
var legitimateTransitions = []struct {
	from library.Status
	to   library.Status
	why  string
}{
	{library.StatusWishlist, library.StatusPending, "lo consigo"},
	{library.StatusPending, library.StatusInProgress, "empiezo"},
	{library.StatusInProgress, library.StatusOnHold, "lo aparco"},
	{library.StatusOnHold, library.StatusInProgress, "retomo"},
	{library.StatusInProgress, library.StatusCompleted, "termino"},
	{library.StatusInProgress, library.StatusDropped, "lo dejo"},
	{library.StatusCompleted, library.StatusInProgress, "revisito"},
}

func TestTheStateMachineDrawsEveryTransitionTheDomainDocuments(t *testing.T) {
	t.Parallel()

	for _, transition := range legitimateTransitions {
		t.Run(fmt.Sprintf("%s_to_%s", transition.from, transition.to), func(t *testing.T) {
			t.Parallel()

			assert.True(t, library.CanTransition(transition.from, transition.to), transition.why)
		})
	}
}

func TestTheStateMachineRefusesATransitionTheDomainDoesNotDraw(t *testing.T) {
	t.Parallel()

	refused := []struct {
		from library.Status
		to   library.Status
		why  string
	}{
		{library.StatusWishlist, library.StatusInProgress, "you cannot start what you have not got yet"},
		{library.StatusWishlist, library.StatusCompleted, "finishing something you only wanted is the bug this machine exists to stop"},
		{library.StatusWishlist, library.StatusOnHold, "nothing to park"},
		{library.StatusWishlist, library.StatusDropped, "dropping what you never started is removing it"},
		{library.StatusPending, library.StatusCompleted, "no"},
		{library.StatusPending, library.StatusDropped, "no"},
		{library.StatusPending, library.StatusOnHold, "no"},
		{library.StatusPending, library.StatusWishlist, "you already have it"},
		{library.StatusOnHold, library.StatusCompleted, "you resume before you finish"},
		{library.StatusOnHold, library.StatusDropped, "you resume before you drop"},
		{library.StatusInProgress, library.StatusPending, "no going back to not started"},
		{library.StatusInProgress, library.StatusWishlist, "no"},
		{library.StatusCompleted, library.StatusDropped, "you did not drop what you finished"},
		{library.StatusCompleted, library.StatusOnHold, "revisit first"},
		{library.StatusCompleted, library.StatusWishlist, "no"},
		{library.StatusDropped, library.StatusInProgress, "picking it up again starts from the shelf, not from the bin"},
		{library.StatusDropped, library.StatusCompleted, "no"},
		{library.StatusDropped, library.StatusOnHold, "no"},
	}

	for _, transition := range refused {
		t.Run(fmt.Sprintf("%s_to_%s", transition.from, transition.to), func(t *testing.T) {
			t.Parallel()

			assert.False(t, library.CanTransition(transition.from, transition.to), transition.why)
		})
	}
}

func TestTheStateMachineAcceptsTheStatusAnEntryAlreadyHas(t *testing.T) {
	t.Parallel()

	for _, status := range allStatuses() {
		assert.Truef(t, library.CanTransition(status, status),
			"a client resending the state it already holds is asking for nothing, not for an illegal move: %s", status)
	}
}

func TestTheStateMachineRefusesAStatusThatDoesNotExist(t *testing.T) {
	t.Parallel()

	assert.False(t, library.CanTransition(library.StatusInProgress, library.Status("finito")))
	assert.False(t, library.CanTransition(library.Status("finito"), library.StatusInProgress))
}

func TestOnlyCompletedAndDroppedAcceptARatingArrivingInTheRequest(t *testing.T) {
	t.Parallel()

	assert.True(t, library.StatusCompleted.AllowsRating())
	assert.True(t, library.StatusDropped.AllowsRating())

	for _, status := range []library.Status{
		library.StatusWishlist, library.StatusPending, library.StatusInProgress, library.StatusOnHold,
	} {
		assert.Falsef(t, status.AllowsRating(),
			"domain rule 2: scoring something you have not formed an opinion about means nothing: %s", status)
	}
}

func TestAnAnimeCapsProgressAtTheEpisodeCountTheCatalogueKnows(t *testing.T) {
	t.Parallel()

	finished := library.Work{
		Category: library.CategoryAnime,
		Metadata: library.Metadata{library.MetadataKeyEpisodes: 24},
	}

	total, known := finished.Total()
	require.True(t, known)
	assert.Equal(t, 24, total)

	require.NoError(t, library.ValidateProgress(finished, 24), "finishing the last episode is the point")
	require.ErrorIs(t, library.ValidateProgress(finished, 25), library.ErrInvalidProgress)
}

func TestAnAiringAnimeAcceptsProgressWithoutACeiling(t *testing.T) {
	t.Parallel()

	airing := library.Work{
		Category: library.CategoryAnime,
		Metadata: library.Metadata{"status_airing": "airing"},
	}

	_, known := airing.Total()
	assert.False(t, known, "the catalogue never said how many episodes this run has")
	assert.NoError(t, library.ValidateProgress(airing, 999),
		"refusing episode 999 would be the domain inventing a fact nobody gave it")
}

func TestProgressIsNeverNegative(t *testing.T) {
	t.Parallel()

	require.ErrorIs(t,
		library.ValidateProgress(library.Work{Category: library.CategoryAnime}, -1),
		library.ErrInvalidProgress)
}

func TestACategoryThatHasNotDeclaredItsUnitCapsNothing(t *testing.T) {
	t.Parallel()

	// episodes is an anime key. A board game carrying it by accident does not
	// suddenly gain a ceiling measured in something it does not have.
	boardGame := library.Work{
		Category: library.CategoryBoardGame,
		Metadata: library.Metadata{library.MetadataKeyEpisodes: 3},
	}

	_, known := boardGame.Total()
	assert.False(t, known)
	assert.NoError(t, library.ValidateProgress(boardGame, 40))
}

func TestAnEpisodeCountThatIsNotAWholeNumberIsNoCeilingAtAll(t *testing.T) {
	t.Parallel()

	// metadata crosses a JSON boundary, where an integer arrives as a
	// float64 and anything at all can arrive as a string.
	fromJSON := library.Work{
		Category: library.CategoryAnime,
		Metadata: library.Metadata{library.MetadataKeyEpisodes: float64(12)},
	}
	total, known := fromJSON.Total()
	require.True(t, known)
	assert.Equal(t, 12, total)

	for _, nonsense := range []any{"twelve", 12.5, -3, nil} {
		work := library.Work{
			Category: library.CategoryAnime,
			Metadata: library.Metadata{library.MetadataKeyEpisodes: nonsense},
		}
		_, known := work.Total()
		assert.Falsef(t, known, "%v is not an episode count", nonsense)
	}
}

func allStatuses() []library.Status {
	return []library.Status{
		library.StatusWishlist,
		library.StatusPending,
		library.StatusInProgress,
		library.StatusCompleted,
		library.StatusDropped,
		library.StatusOnHold,
	}
}
