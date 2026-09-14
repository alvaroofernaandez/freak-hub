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

// TestTheStateMachineAnswersExactlyTheDiagramForAllThirtySixPairs walks
// every ordered pair of statuses, not a hand-written list of the ones
// somebody thought of.
//
// A list of refusals is only as complete as the day it was written: the
// first version of this test named eighteen pairs and quietly left five
// unchecked. Six by six is thirty-six, the whole space, and the expectation
// for each pair is derived from the arrows the documentation draws rather
// than restated by hand — so the diagram stays the single source of truth
// and the coverage is complete by construction.
func TestTheStateMachineAnswersExactlyTheDiagramForAllThirtySixPairs(t *testing.T) {
	t.Parallel()

	drawn := make(map[library.Status]map[library.Status]bool)
	for _, transition := range legitimateTransitions {
		if drawn[transition.from] == nil {
			drawn[transition.from] = make(map[library.Status]bool)
		}

		drawn[transition.from][transition.to] = true
	}

	checked := 0

	for _, from := range allStatuses() {
		for _, to := range allStatuses() {
			checked++

			// Staying put is a no-op, not a move, so it needs no arrow.
			want := from == to || drawn[from][to]

			assert.Equalf(t, want, library.CanTransition(from, to), "%s → %s", from, to)
		}
	}

	assert.Equal(t, len(allStatuses())*len(allStatuses()), checked,
		"every ordered pair of statuses is accounted for")
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

// TestAnEpisodeCountOfZeroMeansTheCatalogueDoesNotKnow is the difference
// between a syntactically valid number and a real fact.
//
// A real catalogue publishes 0 for something not yet aired. Read as a known
// ceiling of zero, that entry can never move: every progress above 0 is
// refused, and the member is stuck with no way out. And "there exist zero
// episodes" is not a state any work a person could watch is ever in — the
// honest reading of 0 is that nobody has said yet.
func TestAnEpisodeCountOfZeroMeansTheCatalogueDoesNotKnow(t *testing.T) {
	t.Parallel()

	unaired := library.Work{
		Category: library.CategoryAnime,
		Metadata: library.Metadata{library.MetadataKeyEpisodes: 0},
	}

	_, known := unaired.Total()
	assert.False(t, known, "0 is what a catalogue publishes for a run that has not started")
	assert.NoError(t, library.ValidateProgress(unaired, 1),
		"a known ceiling of zero would trap the entry: every progress above 0 refused, forever")
}

// TestProgressNeverPassesWhatAnyColumnCouldHold is the other end of domain
// rule 5, and it is not hypothetical: without it a well-formed request
// reached the adapter, which refused to truncate — rightly — with a bare
// error, and the caller got a 500 for a request the domain should have
// turned away.
func TestProgressNeverPassesWhatAnyColumnCouldHold(t *testing.T) {
	t.Parallel()

	// An airing anime declares no total, so rule 5's ceiling does not apply
	// and this is the only bound left.
	airing := library.Work{
		Category: library.CategoryAnime,
		Metadata: library.Metadata{"status_airing": "airing"},
	}

	require.NoError(t, library.ValidateProgress(airing, 2_147_483_647),
		"the widest count a column holds is still a count")
	require.ErrorIs(t, library.ValidateProgress(airing, 2_147_483_648), library.ErrInvalidProgress)
	require.ErrorIs(t, library.ValidateProgress(airing, 3_000_000_000), library.ErrInvalidProgress)
}
