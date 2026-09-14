package library_test

import (
	"context"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library/librarymem"
)

// harness wires the service to the in-memory doubles, which is the whole
// point of the ports: the same tests would pass against Postgres.
type harness struct {
	service *library.Service
	works   *librarymem.WorkRepository
	entries *librarymem.EntryRepository
	clock   time.Time
}

func newHarness(t *testing.T) *harness {
	t.Helper()

	works := librarymem.NewWorkRepository()
	entries := librarymem.NewEntryRepository(works)
	h := &harness{
		works:   works,
		entries: entries,
		clock:   time.Date(2026, time.March, 1, 12, 0, 0, 0, time.UTC),
	}
	works.NowFunc = func() time.Time { return h.clock }
	entries.NowFunc = func() time.Time { return h.clock }
	h.service = library.NewService(library.ServiceDeps{Works: works, Entries: entries})

	return h
}

// anime seeds a finished anime whose episode count the catalogue knows, which
// is the case where domain rule 5 has a ceiling to enforce.
func (h *harness) anime(title string, episodes int) library.Work {
	return h.works.Seed(library.Work{
		Title:    title,
		Category: library.CategoryAnime,
		Source:   library.SourceAniList,
		SourceID: title,
		Metadata: library.Metadata{library.MetadataKeyEpisodes: episodes},
	})
}

// airingAnime seeds an anime the catalogue has not given an episode count
// for, which is the case where domain rule 5 has no ceiling to enforce.
func (h *harness) airingAnime(title string) library.Work {
	return h.works.Seed(library.Work{
		Title:    title,
		Category: library.CategoryAnime,
		Source:   library.SourceAniList,
		SourceID: title,
		Metadata: library.Metadata{"status_airing": "airing"},
	})
}

func ratingOf(value int) *int { return &value }

// seedWork puts a work in the catalogue at a pinned creation time, so the
// keyset order the listings promise is deterministic.
func (h *harness) seedWork(title string, category library.Category, createdAt time.Time) library.Work {
	return h.works.Seed(library.Work{
		Title:     title,
		Category:  category,
		Source:    library.SourceManual,
		CreatedAt: createdAt,
	})
}

func TestCreateManualWorkStampsTheManualSourceAndLeavesTheSourceIDEmpty(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	work, err := h.service.CreateManualWork(context.Background(), library.ManualWorkInput{
		Title:    "Kimetsu no Yaiba",
		Category: library.CategoryAnime,
	})

	require.NoError(t, err)
	assert.Equal(t, library.SourceManual, work.Source,
		"a work typed in by hand can only be manual: claiming another source would poison the deduplication imported works rely on")
	assert.Empty(t, work.SourceID, "a manual work points at no external record")
	assert.NotEqual(t, uuid.Nil, work.ID)
	assert.Equal(t, "Kimetsu no Yaiba", work.Title)
}

func TestCreateManualWorkTrimsTheTitle(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	work, err := h.service.CreateManualWork(context.Background(), library.ManualWorkInput{
		Title:    "  Frieren  ",
		Category: library.CategoryAnime,
	})

	require.NoError(t, err)
	assert.Equal(t, "Frieren", work.Title)
}

func TestCreateManualWorkRefusesAnEmptyTitle(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, err := h.service.CreateManualWork(context.Background(), library.ManualWorkInput{
		Title:    "   ",
		Category: library.CategoryAnime,
	})

	require.ErrorIs(t, err, library.ErrInvalidTitle)
}

func TestCreateManualWorkRefusesATitleLongerThanTheContractAllows(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, err := h.service.CreateManualWork(context.Background(), library.ManualWorkInput{
		Title:    strings.Repeat("a", library.MaxTitleLength+1),
		Category: library.CategoryAnime,
	})

	require.ErrorIs(t, err, library.ErrInvalidTitle)
}

func TestCreateManualWorkRefusesACategoryThatDoesNotExist(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, err := h.service.CreateManualWork(context.Background(), library.ManualWorkInput{
		Title:    "Something",
		Category: library.Category("vinyl"),
	})

	require.ErrorIs(t, err, library.ErrInvalidCategory)
}

func TestGetWorkReturnsTheRecordFromTheSharedCatalogue(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	seeded := h.anime("Kimetsu no Yaiba", 26)

	got, err := h.service.GetWork(context.Background(), seeded.ID)

	require.NoError(t, err)
	assert.Equal(t, seeded.ID, got.ID)
	assert.Equal(t, "Kimetsu no Yaiba", got.Title,
		"the catalogue is shared, so any member reads any work by its id")
}

func TestGetWorkReportsAWorkThatIsNotInTheCatalogue(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, err := h.service.GetWork(context.Background(), uuid.New())

	require.ErrorIs(t, err, library.ErrWorkNotFound)
}

func TestSearchWorksRefusesALimitOutsideTheAllowedRange(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	for _, limit := range []int{0, -1, library.MaxListLimit + 1} {
		_, _, err := h.service.SearchWorks(context.Background(), library.WorkFilter{}, nil, limit)
		require.ErrorIsf(t, err, library.ErrInvalidLimit, "limit %d", limit)
	}
}

func TestSearchWorksRefusesACategoryFilterThatDoesNotExist(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, _, err := h.service.SearchWorks(
		context.Background(), library.WorkFilter{Category: library.Category("vinyl")}, nil, 25,
	)

	require.ErrorIs(t, err, library.ErrInvalidFilter,
		"an unknown filter is rejected, never answered with the unfiltered list")
}

func TestSearchWorksPagesThroughTheCatalogueNewestFirst(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	base := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	oldest := h.seedWork("Oldest", library.CategoryAnime, base)
	middle := h.seedWork("Middle", library.CategoryAnime, base.Add(time.Hour))
	newest := h.seedWork("Newest", library.CategoryAnime, base.Add(2*time.Hour))

	first, next, err := h.service.SearchWorks(context.Background(), library.WorkFilter{}, nil, 2)
	require.NoError(t, err)
	require.Len(t, first, 2)
	assert.Equal(t, []uuid.UUID{newest.ID, middle.ID}, idsOf(first))
	require.NotNil(t, next, "a full page with more behind it hands back a cursor")

	second, last, err := h.service.SearchWorks(context.Background(), library.WorkFilter{}, next, 2)
	require.NoError(t, err)
	assert.Equal(t, []uuid.UUID{oldest.ID}, idsOf(second))
	assert.Nil(t, last, "the last page hands back no cursor")
}

func TestSearchWorksMatchesTitlesIgnoringCaseAndAccents(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	base := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	wanted := h.seedWork("Kimetsu no Yaiba", library.CategoryAnime, base)
	h.seedWork("Frieren", library.CategoryAnime, base.Add(time.Hour))

	found, _, err := h.service.SearchWorks(
		context.Background(), library.WorkFilter{Query: "  KIMÉTSU  "}, nil, 25,
	)

	require.NoError(t, err)
	assert.Equal(t, []uuid.UUID{wanted.ID}, idsOf(found))
}

func TestSearchWorksKeepsOnlyTheCategoryAsked(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	base := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	anime := h.seedWork("Frieren", library.CategoryAnime, base)
	h.seedWork("Gloomhaven", library.CategoryBoardGame, base.Add(time.Hour))

	found, _, err := h.service.SearchWorks(
		context.Background(), library.WorkFilter{Category: library.CategoryAnime}, nil, 25,
	)

	require.NoError(t, err)
	assert.Equal(t, []uuid.UUID{anime.ID}, idsOf(found))
}

// TestWorkRepositoryOffersNoWayToDeleteAWork is domain rule 3. A work is
// shared history: it is never removed, not even when nobody keeps it any
// more. The rule is enforced by the port's shape rather than by a check
// somebody can forget to write, and this test is what keeps that shape.
func TestWorkRepositoryOffersNoWayToDeleteAWork(t *testing.T) {
	t.Parallel()

	port := reflect.TypeOf((*library.WorkRepository)(nil)).Elem()

	for i := range port.NumMethod() {
		name := port.Method(i).Name
		assert.NotContains(t, strings.ToLower(name), "delete", "domain rule 3: a work is never deleted")
		assert.NotContains(t, strings.ToLower(name), "remove", "domain rule 3: a work is never deleted")
	}
}

func idsOf(works []library.Work) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(works))
	for _, work := range works {
		ids = append(ids, work.ID)
	}

	return ids
}

func TestAddToLibraryRegistersTheWorkForTheMember(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)

	entry, err := h.service.AddToLibrary(context.Background(), member, library.AddToLibraryInput{
		WorkID:   work.ID,
		Status:   library.StatusInProgress,
		Progress: 12,
	})

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, entry.ID)
	assert.Equal(t, member, entry.MemberID)
	assert.Equal(t, work.ID, entry.WorkID)
	assert.Equal(t, library.StatusInProgress, entry.Status)
	assert.Equal(t, 12, entry.Progress)
	assert.Nil(t, entry.Rating)
}

// TestAddToLibraryRefusesADuplicateForTheSameMember is domain rule 1: a
// member holds at most one entry per work. Watching something again is
// progress on the entry that already exists, not a second row.
func TestAddToLibraryRefusesADuplicateForTheSameMember(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	input := library.AddToLibraryInput{WorkID: work.ID, Status: library.StatusPending}

	_, err := h.service.AddToLibrary(context.Background(), member, input)
	require.NoError(t, err)

	_, err = h.service.AddToLibrary(context.Background(), member, input)
	require.ErrorIs(t, err, library.ErrAlreadyInLibrary)
}

// TestAddToLibraryLetsTwoMembersRegisterTheSameWork is domain rule 1's other
// half, and the reason works are shared at all: the overlap is what will make
// matches and recommendations mean something.
func TestAddToLibraryLetsTwoMembersRegisterTheSameWork(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	work := h.anime("Frieren", 28)
	input := library.AddToLibraryInput{WorkID: work.ID, Status: library.StatusPending}

	mine, err := h.service.AddToLibrary(context.Background(), uuid.New(), input)
	require.NoError(t, err)

	yours, err := h.service.AddToLibrary(context.Background(), uuid.New(), input)
	require.NoError(t, err)

	assert.Equal(t, mine.WorkID, yours.WorkID, "both point at the same work")
	assert.NotEqual(t, mine.ID, yours.ID, "and each has their own entry")
}

func TestAddToLibraryRefusesAWorkThatDoesNotExist(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
		WorkID: uuid.New(),
		Status: library.StatusPending,
	})

	require.ErrorIs(t, err, library.ErrWorkNotFound)
}

func TestAddToLibraryRefusesACallWithNoMemberBehindIt(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	work := h.anime("Frieren", 28)

	_, err := h.service.AddToLibrary(context.Background(), uuid.Nil, library.AddToLibraryInput{
		WorkID: work.ID,
		Status: library.StatusPending,
	})

	require.ErrorIs(t, err, library.ErrMissingMember)
}

// TestAddToLibraryAcceptsAnyOfTheSixStatuses is the contract's decision, and
// it is not the state machine being ignored: creating is the entry point into
// the lifecycle, not a transition. Registering an anime you finished years
// ago is ordinary, and forcing it through pending plus a PATCH would be
// theatre.
func TestAddToLibraryAcceptsAnyOfTheSixStatuses(t *testing.T) {
	t.Parallel()

	for _, status := range allStatuses() {
		t.Run(string(status), func(t *testing.T) {
			t.Parallel()

			h := newHarness(t)
			work := h.anime("Frieren", 28)

			entry, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
				WorkID: work.ID,
				Status: status,
			})

			require.NoError(t, err)
			assert.Equal(t, status, entry.Status)
		})
	}
}

func TestAddToLibraryRefusesAStatusThatDoesNotExist(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	work := h.anime("Frieren", 28)

	_, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
		WorkID: work.ID,
		Status: library.Status("watching"),
	})

	require.ErrorIs(t, err, library.ErrInvalidStatus)
}

// TestAddToLibraryAcceptsARatingOnACompletedEntry is domain rule 2 passing:
// registering something you finished years ago, with the score you gave it,
// is the ordinary case.
func TestAddToLibraryAcceptsARatingOnACompletedEntry(t *testing.T) {
	t.Parallel()

	for _, status := range []library.Status{library.StatusCompleted, library.StatusDropped} {
		t.Run(string(status), func(t *testing.T) {
			t.Parallel()

			h := newHarness(t)
			work := h.anime("Frieren", 28)

			entry, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
				WorkID: work.ID,
				Status: status,
				Rating: ratingOf(9),
			})

			require.NoError(t, err)
			require.NotNil(t, entry.Rating)
			assert.Equal(t, 9, *entry.Rating)
		})
	}
}

// TestAddToLibraryRefusesARatingOnAWishlistEntry is domain rule 2 failing:
// scoring something you have not even started means nothing.
func TestAddToLibraryRefusesARatingOnAWishlistEntry(t *testing.T) {
	t.Parallel()

	for _, status := range []library.Status{
		library.StatusWishlist, library.StatusPending, library.StatusInProgress, library.StatusOnHold,
	} {
		t.Run(string(status), func(t *testing.T) {
			t.Parallel()

			h := newHarness(t)
			work := h.anime("Frieren", 28)

			_, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
				WorkID: work.ID,
				Status: status,
				Rating: ratingOf(9),
			})

			require.ErrorIs(t, err, library.ErrRatingNotAllowed)
		})
	}
}

func TestAddToLibraryRefusesARatingOutsideOneToTen(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	work := h.anime("Frieren", 28)

	for _, rating := range []int{0, -1, library.MaxRating + 1} {
		_, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
			WorkID: work.ID,
			Status: library.StatusCompleted,
			Rating: ratingOf(rating),
		})
		require.ErrorIsf(t, err, library.ErrInvalidRating, "rating %d", rating)
	}
}

// TestAddToLibraryRefusesNegativeProgress is domain rule 5's easy half.
func TestAddToLibraryRefusesNegativeProgress(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	work := h.anime("Frieren", 28)

	_, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
		WorkID:   work.ID,
		Status:   library.StatusInProgress,
		Progress: -1,
	})

	require.ErrorIs(t, err, library.ErrInvalidProgress)
}

// TestAddToLibraryRefusesProgressPastAKnownEpisodeCount is domain rule 5
// where the ceiling exists.
func TestAddToLibraryRefusesProgressPastAKnownEpisodeCount(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	work := h.anime("Frieren", 28)

	_, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
		WorkID:   work.ID,
		Status:   library.StatusInProgress,
		Progress: 29,
	})

	require.ErrorIs(t, err, library.ErrInvalidProgress)
}

// TestAddToLibraryAcceptsProgressOnAnAnimeStillAiring is domain rule 5 where
// it does not, and the nuance the issue said would only surface by writing
// the test first.
func TestAddToLibraryAcceptsProgressOnAnAnimeStillAiring(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	work := h.airingAnime("Dandadan")

	entry, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
		WorkID:   work.ID,
		Status:   library.StatusInProgress,
		Progress: 13,
	})

	require.NoError(t, err, "the catalogue never said how many episodes there are, so there is nothing to exceed")
	assert.Equal(t, 13, entry.Progress)
}

// addEntry registers a work for a member through the service, which is the
// only door: seeding an entry directly would let a test start from a state
// the domain would never have allowed.
func (h *harness) addEntry(
	t *testing.T, member uuid.UUID, work library.Work, input library.AddToLibraryInput,
) library.EntryWithWork {
	t.Helper()

	input.WorkID = work.ID

	entry, err := h.service.AddToLibrary(context.Background(), member, input)
	require.NoError(t, err)

	return entry
}

func TestUpdateEntryMovesTheStatusAlongATransitionTheDomainDraws(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{Status: library.StatusPending})

	updated, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Status:   library.Set(library.StatusInProgress),
		Progress: library.Set(3),
	})

	require.NoError(t, err)
	assert.Equal(t, library.StatusInProgress, updated.Status)
	assert.Equal(t, 3, updated.Progress)
	assert.Equal(t, work.ID, updated.Work.ID, "the work travels inline with the entry")
}

func TestUpdateEntryRefusesATransitionTheStateMachineDoesNotDraw(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{Status: library.StatusWishlist})

	_, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Status: library.Set(library.StatusCompleted),
	})

	require.ErrorIs(t, err, library.ErrInvalidTransition,
		"finishing something you only ever wanted is the jump this machine exists to refuse")
}

func TestUpdateEntryRefusesAStatusThatDoesNotExist(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{Status: library.StatusPending})

	_, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Status: library.Set(library.Status("watching")),
	})

	require.ErrorIs(t, err, library.ErrInvalidStatus)
}

// TestUpdateEntryKeepsAStoredRatingWhenTheEntryIsRevisited is the decision
// the contract already took, and the one easiest to get wrong: domain rule 2
// applies to a rating *arriving in a request*, not to one already saved.
// completed → in_progress is a rewatch; there is no rating history to restore
// from, so erasing the score would be silent data loss.
func TestUpdateEntryKeepsAStoredRatingWhenTheEntryIsRevisited(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{
		Status: library.StatusCompleted,
		Rating: ratingOf(8),
	})

	updated, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Status: library.Set(library.StatusInProgress),
	})

	require.NoError(t, err, "a rewatch is a legitimate move and carries no rating of its own")
	require.NotNil(t, updated.Rating, "the score survives the status change")
	assert.Equal(t, 8, *updated.Rating)
}

// TestUpdateEntryClearsTheRatingOnlyWhenAskedTo is the other side of the same
// decision: clearing a score is something you ask for, by sending null.
func TestUpdateEntryClearsTheRatingOnlyWhenAskedTo(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{
		Status: library.StatusCompleted,
		Rating: ratingOf(8),
	})

	updated, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Rating: library.Set[*int](nil),
	})

	require.NoError(t, err, "removing a score is always allowed: what rule 2 guards is adding one")
	assert.Nil(t, updated.Rating)
}

// TestUpdateEntryRefusesARatingArrivingOnAnUnfinishedEntry is domain rule 2
// on the PATCH.
func TestUpdateEntryRefusesARatingArrivingOnAnUnfinishedEntry(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{Status: library.StatusInProgress})

	_, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Rating: library.Set(ratingOf(9)),
	})

	require.ErrorIs(t, err, library.ErrRatingNotAllowed)
}

// TestUpdateEntryAcceptsTheRatingThatArrivesWithTheCompletion is the ordinary
// way a score is given: the rule is checked against the status the entry ends
// up in, not the one it came from.
func TestUpdateEntryAcceptsTheRatingThatArrivesWithTheCompletion(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{
		Status:   library.StatusInProgress,
		Progress: 27,
	})

	updated, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Status:   library.Set(library.StatusCompleted),
		Progress: library.Set(28),
		Rating:   library.Set(ratingOf(10)),
	})

	require.NoError(t, err)
	require.NotNil(t, updated.Rating)
	assert.Equal(t, 10, *updated.Rating)
}

func TestUpdateEntryRefusesProgressPastAKnownEpisodeCount(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{Status: library.StatusInProgress})

	_, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Progress: library.Set(29),
	})

	require.ErrorIs(t, err, library.ErrInvalidProgress)
}

func TestUpdateEntryLeavesAbsentFieldsAlone(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	note := "empezado en el tren"
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{
		Status:   library.StatusInProgress,
		Progress: 4,
		Owned:    true,
		Note:     &note,
	})

	updated, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		IsFavourite: library.Set(true),
	})

	require.NoError(t, err)
	assert.True(t, updated.IsFavourite)
	assert.Equal(t, 4, updated.Progress, "an absent field is not the same as a null one")
	assert.True(t, updated.Owned)
	require.NotNil(t, updated.Note)
	assert.Equal(t, note, *updated.Note)
}

// TestUpdateEntryOnAnEmptyPatchChangesNothing means the whole entry, and
// that includes updated_at.
//
// docs/domain.md resolves the activity feed by reading changes to
// LibraryEntry rather than from an events table, so a touched timestamp is
// not bookkeeping nobody sees: it is the group being told that somebody
// updated something, when nobody did.
func TestUpdateEntryOnAnEmptyPatchChangesNothing(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	note := "empezado en el tren"
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{
		Status:   library.StatusInProgress,
		Progress: 4,
		Owned:    true,
		Note:     &note,
	})

	// Time moves between the two calls, so a timestamp that is rewritten
	// cannot look unchanged by accident.
	h.clock = h.clock.Add(48 * time.Hour)

	updated, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{})

	require.NoError(t, err, "an empty body is a no-op, and a no-op answers 200")
	assert.Equal(t, entry.Entry, updated.Entry,
		"a body with no fields touches nothing at all, updated_at included")
	assert.Equal(t, entry.UpdatedAt, updated.UpdatedAt,
		"or the activity feed reports a change that never happened")
}

// TestUpdateEntryOnAPatchThatSetsTheSameValuesStillStamps draws the line:
// what is skipped is a body with no fields, not a body whose fields happen
// to match. A client that sent something did ask for a write.
func TestUpdateEntryOnAPatchThatSetsTheSameValuesStillStamps(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{
		Status:   library.StatusInProgress,
		Progress: 4,
	})

	h.clock = h.clock.Add(48 * time.Hour)

	updated, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Progress: library.Set(4),
	})

	require.NoError(t, err)
	assert.Equal(t, 4, updated.Progress)
	assert.True(t, updated.UpdatedAt.After(entry.UpdatedAt))
}

// TestUpdateEntryRefusesAnEntryThatBelongsToSomebodyElse is the 404-never-403
// decision: whose library holds what is nobody else's business, so refusing
// with a 403 would confirm the entry exists.
func TestUpdateEntryRefusesAnEntryThatBelongsToSomebodyElse(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	owner := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, owner, work, library.AddToLibraryInput{Status: library.StatusPending})

	_, err := h.service.UpdateEntry(context.Background(), uuid.New(), entry.ID, library.EntryPatch{
		Status: library.Set(library.StatusInProgress),
	})

	require.ErrorIs(t, err, library.ErrEntryNotFound,
		"the answer is the same one a missing entry gets: 404, never 403")

	untouched, err := h.service.GetEntry(context.Background(), owner, entry.ID)
	require.NoError(t, err)
	assert.Equal(t, library.StatusPending, untouched.Status)
}

func TestUpdateEntryRefusesAnEntryThatDoesNotExist(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, err := h.service.UpdateEntry(context.Background(), uuid.New(), uuid.New(), library.EntryPatch{})

	require.ErrorIs(t, err, library.ErrEntryNotFound)
}

func TestGetEntryRefusesAnEntryThatBelongsToSomebodyElse(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	owner := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, owner, work, library.AddToLibraryInput{Status: library.StatusPending})

	_, err := h.service.GetEntry(context.Background(), uuid.New(), entry.ID)

	require.ErrorIs(t, err, library.ErrEntryNotFound)
}

func TestRemoveFromLibraryTakesTheWorkOffTheMembersShelf(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{Status: library.StatusPending})

	require.NoError(t, h.service.RemoveFromLibrary(context.Background(), member, entry.ID))

	_, err := h.service.GetEntry(context.Background(), member, entry.ID)
	require.ErrorIs(t, err, library.ErrEntryNotFound)
}

// TestRemoveFromLibraryKeepsTheWorkInTheSharedCatalogue is domain rule 3 seen
// from the side the domain can actually enforce: what leaves is the
// relationship, never the shared history.
func TestRemoveFromLibraryKeepsTheWorkInTheSharedCatalogue(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{Status: library.StatusPending})

	require.NoError(t, h.service.RemoveFromLibrary(context.Background(), member, entry.ID))

	catalogue, _, err := h.service.SearchWorks(context.Background(), library.WorkFilter{}, nil, 25)
	require.NoError(t, err)
	assert.Equal(t, []uuid.UUID{work.ID}, idsOf(catalogue),
		"nobody keeps it any more and it is still there: a work is shared history")
}

// TestRemoveFromLibraryRefusesAnEntryThatBelongsToSomebodyElse is the only
// ownership rule the issue spells out, and the entry has to survive it.
func TestRemoveFromLibraryRefusesAnEntryThatBelongsToSomebodyElse(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	owner := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, owner, work, library.AddToLibraryInput{Status: library.StatusPending})

	err := h.service.RemoveFromLibrary(context.Background(), uuid.New(), entry.ID)
	require.ErrorIs(t, err, library.ErrEntryNotFound, "404, never 403")

	survivor, err := h.service.GetEntry(context.Background(), owner, entry.ID)
	require.NoError(t, err, "somebody else's DELETE did not take it")
	assert.Equal(t, entry.ID, survivor.ID)
}

func TestRemoveFromLibraryRefusesAnEntryThatDoesNotExist(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	require.ErrorIs(t,
		h.service.RemoveFromLibrary(context.Background(), uuid.New(), uuid.New()),
		library.ErrEntryNotFound)
}

// TestRemoveFromLibraryWorksFromAnyStatus keeps the two ends of the state
// diagram from being read as a guard: leaving the library is a deletion, and
// the contract puts no status condition on it.
func TestRemoveFromLibraryWorksFromAnyStatus(t *testing.T) {
	t.Parallel()

	for _, status := range allStatuses() {
		t.Run(string(status), func(t *testing.T) {
			t.Parallel()

			h := newHarness(t)
			member := uuid.New()
			work := h.anime("Frieren", 28)
			entry := h.addEntry(t, member, work, library.AddToLibraryInput{Status: status})

			require.NoError(t, h.service.RemoveFromLibrary(context.Background(), member, entry.ID))
		})
	}
}

func TestListLibraryNeverShowsAnotherMembersShelf(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	mine, yours := uuid.New(), uuid.New()
	work := h.anime("Frieren", 28)
	own := h.addEntry(t, mine, work, library.AddToLibraryInput{Status: library.StatusPending})
	h.addEntry(t, yours, work, library.AddToLibraryInput{Status: library.StatusCompleted})

	// Even asked outright for somebody else's shelf, the listing answers with
	// the caller's own: the owner is not a filter a caller gets to choose.
	page, _, err := h.service.ListLibrary(
		context.Background(), mine, library.EntryFilter{MemberID: yours}, nil, 25,
	)

	require.NoError(t, err)
	require.Len(t, page, 1)
	assert.Equal(t, own.ID, page[0].ID)
}

func TestListLibraryKeepsOnlyTheStatusAsked(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	watching := h.addEntry(t, member, h.anime("Frieren", 28), library.AddToLibraryInput{
		Status: library.StatusInProgress,
	})
	h.addEntry(t, member, h.anime("Monster", 74), library.AddToLibraryInput{
		Status: library.StatusWishlist,
	})

	page, _, err := h.service.ListLibrary(
		context.Background(), member, library.EntryFilter{Status: library.StatusInProgress}, nil, 25,
	)

	require.NoError(t, err)
	require.Len(t, page, 1)
	assert.Equal(t, watching.ID, page[0].ID)
}

func TestListLibraryKeepsOnlyTheCategoryAsked(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	anime := h.addEntry(t, member, h.anime("Frieren", 28), library.AddToLibraryInput{
		Status: library.StatusPending,
	})
	boardGame := h.works.Seed(library.Work{
		Title:    "Gloomhaven",
		Category: library.CategoryBoardGame,
		Source:   library.SourceBGG,
		SourceID: "174430",
	})
	h.addEntry(t, member, boardGame, library.AddToLibraryInput{Status: library.StatusPending})

	page, _, err := h.service.ListLibrary(
		context.Background(), member, library.EntryFilter{Category: library.CategoryAnime}, nil, 25,
	)

	require.NoError(t, err)
	require.Len(t, page, 1)
	assert.Equal(t, anime.ID, page[0].ID)
	assert.Equal(t, library.CategoryAnime, page[0].Work.Category,
		"the work travels inline, so a library screen needs no second round of requests")
}

func TestListLibraryPagesThroughTheShelfNewestFirst(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()

	added := make([]uuid.UUID, 0, 3)
	for i, title := range []string{"Oldest", "Middle", "Newest"} {
		h.clock = time.Date(2026, time.March, 1, 12, i, 0, 0, time.UTC)
		work := h.works.Seed(library.Work{
			Title: title, Category: library.CategoryAnime, Source: library.SourceManual,
		})
		added = append(added, h.addEntry(t, member, work, library.AddToLibraryInput{
			Status: library.StatusPending,
		}).ID)
	}

	first, next, err := h.service.ListLibrary(context.Background(), member, library.EntryFilter{}, nil, 2)
	require.NoError(t, err)
	require.Len(t, first, 2)
	assert.Equal(t, []uuid.UUID{added[2], added[1]}, entryIDsOf(first))
	require.NotNil(t, next)

	second, last, err := h.service.ListLibrary(context.Background(), member, library.EntryFilter{}, next, 2)
	require.NoError(t, err)
	assert.Equal(t, []uuid.UUID{added[0]}, entryIDsOf(second))
	assert.Nil(t, last)
}

func TestListLibraryRefusesALimitOutsideTheAllowedRange(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	for _, limit := range []int{0, -1, library.MaxListLimit + 1} {
		_, _, err := h.service.ListLibrary(context.Background(), uuid.New(), library.EntryFilter{}, nil, limit)
		require.ErrorIsf(t, err, library.ErrInvalidLimit, "limit %d", limit)
	}
}

func TestListLibraryRefusesAFilterThatDoesNotExist(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()

	_, _, err := h.service.ListLibrary(
		context.Background(), member, library.EntryFilter{Status: library.Status("watching")}, nil, 25,
	)
	require.ErrorIs(t, err, library.ErrInvalidFilter)

	_, _, err = h.service.ListLibrary(
		context.Background(), member, library.EntryFilter{Category: library.Category("vinyl")}, nil, 25,
	)
	require.ErrorIs(t, err, library.ErrInvalidFilter)
}

func TestListLibraryRefusesACallWithNoMemberBehindIt(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, _, err := h.service.ListLibrary(context.Background(), uuid.Nil, library.EntryFilter{}, nil, 25)

	require.ErrorIs(t, err, library.ErrMissingMember)
}

func entryIDsOf(entries []library.EntryWithWork) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(entries))
	for _, entry := range entries {
		ids = append(ids, entry.ID)
	}

	return ids
}

// revisitedAndRated builds the entry at the heart of the rating rule: one
// that is in_progress and still carries the score from the run before.
// Getting there only goes through legitimate moves, which is the point —
// this is an ordinary entry, not a contrived one.
func (h *harness) revisitedAndRated(t *testing.T, member uuid.UUID, score int) library.EntryWithWork {
	t.Helper()

	entry := h.addEntry(t, member, h.anime("Frieren", 28), library.AddToLibraryInput{
		Status: library.StatusCompleted,
		Rating: ratingOf(score),
	})

	revisited, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Status: library.Set(library.StatusInProgress),
	})
	require.NoError(t, err)
	require.NotNil(t, revisited.Rating)
	require.Equal(t, score, *revisited.Rating)

	return revisited
}

// TestUpdateEntryAcceptsTheStoredRatingSentBackUnchanged is what makes PATCH
// idempotent with respect to its own representation. An entry that is
// in_progress and rated 8 is ordinary — a score survives a rewatch — so
// handing it back exactly what the API just returned has to succeed.
// Refusing it would make the state reachable but not re-affirmable.
func TestUpdateEntryAcceptsTheStoredRatingSentBackUnchanged(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	entry := h.revisitedAndRated(t, member, 8)

	updated, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Status: library.Set(library.StatusInProgress),
		Rating: library.Set(ratingOf(8)),
	})

	require.NoError(t, err, "this is the object the API just returned, sent straight back")
	require.NotNil(t, updated.Rating)
	assert.Equal(t, 8, *updated.Rating)
}

// TestUpdateEntryStillRefusesADifferentRatingOnAnUnfinishedEntry is domain
// rule 2 keeping its teeth: what is allowed is a no-op, not a re-score.
func TestUpdateEntryStillRefusesADifferentRatingOnAnUnfinishedEntry(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	entry := h.revisitedAndRated(t, member, 8)

	_, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Rating: library.Set(ratingOf(9)),
	})

	require.ErrorIs(t, err, library.ErrRatingNotAllowed,
		"changing the score halfway through a rewatch is exactly what rule 2 exists to stop")
}

// TestUpdateEntryRefusesAFirstRatingOnAnUnratedUnfinishedEntry is the same
// rule where there is nothing stored to match: a new score on an unfinished
// entry is a change from nothing, and still refused.
func TestUpdateEntryRefusesAFirstRatingOnAnUnratedUnfinishedEntry(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.addEntry(t, member, work, library.AddToLibraryInput{Status: library.StatusInProgress})

	_, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Rating: library.Set(ratingOf(7)),
	})

	require.ErrorIs(t, err, library.ErrRatingNotAllowed)
}

// TestAddToLibraryStillRefusesARatingOnAnUnfinishedEntryWithNothingStored
// pins the asymmetry: on creation there is no stored score for an incoming
// one to match, so the no-op escape hatch cannot exist there.
func TestAddToLibraryStillRefusesARatingOnAnUnfinishedEntryWithNothingStored(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	work := h.anime("Frieren", 28)

	_, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
		WorkID: work.ID,
		Status: library.StatusInProgress,
		Rating: ratingOf(8),
	})

	require.ErrorIs(t, err, library.ErrRatingNotAllowed)
}

// TestUpdateEntryRefusesARatingOutsideOneToTenEvenAsANoOp keeps the range
// check ahead of the no-op escape hatch, so a stored value could never
// launder an impossible one.
func TestUpdateEntryRefusesARatingOutsideOneToTenEvenAsANoOp(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	entry := h.revisitedAndRated(t, member, 8)

	_, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Rating: library.Set(ratingOf(library.MaxRating + 1)),
	})

	require.ErrorIs(t, err, library.ErrInvalidRating)
}

// TestAnEntryYouDoNotOwnIsIndistinguishableFromOneThatDoesNotExist is the
// 404-never-403 promise taken seriously.
//
// errors.Is answers ErrEntryNotFound either way, so the status code was
// always going to be the same. The message was not: one branch wrapped the
// id and the other did not. The moment a handler logs the error or puts it
// in a Problem's detail — which is exactly what a careless first version
// does — that difference lets somebody walk UUIDs and learn which ones are
// real. The two answers have to be the same string, not just the same code.
func TestAnEntryYouDoNotOwnIsIndistinguishableFromOneThatDoesNotExist(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	owner, intruder := uuid.New(), uuid.New()
	work := h.anime("Frieren", 28)
	somebodyElses := h.addEntry(t, owner, work, library.AddToLibraryInput{Status: library.StatusPending})
	imaginary := uuid.New()

	t.Run("GetEntry", func(t *testing.T) {
		t.Parallel()

		_, foreign := h.service.GetEntry(context.Background(), intruder, somebodyElses.ID)
		_, missing := h.service.GetEntry(context.Background(), intruder, imaginary)

		requireIdenticalRefusals(t, foreign, missing)
	})

	t.Run("UpdateEntry", func(t *testing.T) {
		t.Parallel()

		patch := library.EntryPatch{Status: library.Set(library.StatusInProgress)}
		_, foreign := h.service.UpdateEntry(context.Background(), intruder, somebodyElses.ID, patch)
		_, missing := h.service.UpdateEntry(context.Background(), intruder, imaginary, patch)

		requireIdenticalRefusals(t, foreign, missing)
	})

	t.Run("RemoveFromLibrary", func(t *testing.T) {
		t.Parallel()

		foreign := h.service.RemoveFromLibrary(context.Background(), intruder, somebodyElses.ID)
		missing := h.service.RemoveFromLibrary(context.Background(), intruder, imaginary)

		requireIdenticalRefusals(t, foreign, missing)
	})
}

// TestAWorkThatIsNotThereDoesNotEchoTheIdBackInTheError closes the same door
// on the catalogue: nothing is learned from the refusal beyond "not found".
func TestAWorkThatIsNotThereDoesNotEchoTheIdBackInTheError(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	missing := uuid.New()

	_, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
		WorkID: missing,
		Status: library.StatusPending,
	})

	require.ErrorIs(t, err, library.ErrWorkNotFound)
	assert.NotContains(t, err.Error(), missing.String())
	assert.Equal(t, library.ErrWorkNotFound.Error(), err.Error())
}

func requireIdenticalRefusals(t *testing.T, foreign, missing error) {
	t.Helper()

	require.ErrorIs(t, foreign, library.ErrEntryNotFound)
	require.ErrorIs(t, missing, library.ErrEntryNotFound)
	assert.Equal(t, missing.Error(), foreign.Error(),
		"the two refusals must read the same, or the message itself enumerates entries")
	assert.Equal(t, library.ErrEntryNotFound.Error(), foreign.Error(),
		"and neither should be carrying an id around")
}

// racingEntries is an EntryRepository that reports the work as unregistered
// and then refuses to create it — the exact window two interleaved requests
// open between the service's check and its act.
type racingEntries struct {
	*librarymem.EntryRepository
}

func (r racingEntries) ByMemberAndWork(_ context.Context, _, _ uuid.UUID) (library.Entry, error) {
	return library.Entry{}, library.ErrEntryNotFound
}

func (r racingEntries) Create(_ context.Context, _ library.Entry) (library.Entry, error) {
	return library.Entry{}, library.ErrAlreadyInLibrary
}

// TestAddToLibraryAnswersAlreadyInLibraryWhenTheRepositoryWinsTheRace closes
// the check-then-act window. Two taps on "add" can interleave past
// ByMemberAndWork; what the loser must get is the domain's 409, not whatever
// the storage engine happened to raise.
func TestAddToLibraryAnswersAlreadyInLibraryWhenTheRepositoryWinsTheRace(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	work := h.anime("Frieren", 28)
	service := library.NewService(library.ServiceDeps{
		Works:   h.works,
		Entries: racingEntries{EntryRepository: h.entries},
	})

	_, err := service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
		WorkID: work.ID,
		Status: library.StatusPending,
	})

	require.ErrorIs(t, err, library.ErrAlreadyInLibrary)
	assert.Equal(t, library.ErrAlreadyInLibrary.Error(), err.Error(),
		"losing the race reads exactly like losing the check")
}

// TestAnUnairedAnimeImportedWithZeroEpisodesStillAcceptsTheFirstOne is the
// same rule where a member actually feels it: the series starts airing, they
// watch episode 1, and the domain must not refuse it because an importer
// once wrote a 0.
func TestAnUnairedAnimeImportedWithZeroEpisodesStillAcceptsTheFirstOne(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	unaired := h.works.Seed(library.Work{
		Title:    "Algo que aún no se estrena",
		Category: library.CategoryAnime,
		Source:   library.SourceAniList,
		SourceID: "999999",
		Metadata: library.Metadata{
			library.MetadataKeyEpisodes: 0,
			"status_airing":             "not_yet_aired",
		},
	})

	entry, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
		WorkID:   unaired.ID,
		Status:   library.StatusInProgress,
		Progress: 1,
	})

	require.NoError(t, err)
	assert.Equal(t, 1, entry.Progress)
}

// TestEveryPatchableFieldCountsAsAChange walks the eight fields of
// EntryPatch one at a time, because IsEmpty enumerates them by hand and a
// hand-written list of fields rots the same way a hand-written list of
// transitions does — only worse, because this one fails silently.
//
// Forget a field there and a PATCH carrying only that field reads as empty,
// short-circuits, and answers 200 with the entry untouched: the write
// evaporates with a success code. The short-circuit is what makes an empty
// body leave updated_at alone, so the guard against forgetting has to be as
// strong as the reason the short-circuit exists.
//
// Every case uses a value that is either the zero value or an explicit null,
// which is the half most likely to be got wrong: Set(false) and
// Set[*int](nil) are fields a caller sent, not fields a caller omitted.
//
// The count assertion is what catches a ninth field added to EntryPatch and
// to applyPatch but not to IsEmpty — and not to this table either.
func TestEveryPatchableFieldCountsAsAChange(t *testing.T) {
	t.Parallel()

	cases := []struct {
		field string
		patch library.EntryPatch
	}{
		{"Status", library.EntryPatch{Status: library.Set(library.StatusInProgress)}},
		{"Progress", library.EntryPatch{Progress: library.Set(0)}},
		{"Rating", library.EntryPatch{Rating: library.Set[*int](nil)}},
		{"IsFavourite", library.EntryPatch{IsFavourite: library.Set(false)}},
		{"Owned", library.EntryPatch{Owned: library.Set(false)}},
		{"Note", library.EntryPatch{Note: library.Set[*string](nil)}},
		{"StartedAt", library.EntryPatch{StartedAt: library.Set[*time.Time](nil)}},
		{"FinishedAt", library.EntryPatch{FinishedAt: library.Set[*time.Time](nil)}},
	}

	require.Equal(t, reflect.TypeOf(library.EntryPatch{}).NumField(), len(cases),
		"a new patchable field needs a row here, or IsEmpty can forget it and a write vanishes behind a 200")

	assert.True(t, library.EntryPatch{}.IsEmpty(), "and a patch with nothing in it is still empty")

	for _, testCase := range cases {
		t.Run(testCase.field, func(t *testing.T) {
			t.Parallel()

			assert.False(t, testCase.patch.IsEmpty(),
				"a field the caller sent is a field the caller sent, whatever its value")

			h := newHarness(t)
			member := uuid.New()
			entry := h.addEntry(t, member, h.anime("Frieren", 28), library.AddToLibraryInput{
				Status: library.StatusPending,
			})

			h.clock = h.clock.Add(48 * time.Hour)

			updated, err := h.service.UpdateEntry(context.Background(), member, entry.ID, testCase.patch)

			require.NoError(t, err)
			assert.True(t, updated.UpdatedAt.After(entry.UpdatedAt),
				"the write reached the repository instead of being swallowed as a no-op")
		})
	}
}

// The four bounds the contract declares and the domain used not to enforce.
// Three of them were merely permissive; the year was a 500, because an int4
// column cannot hold 2147483648 and the adapter refused to truncate it.

func TestCreateManualWorkRefusesAYearOutsideTheRangeTheContractDeclares(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	for _, year := range []int{1799, 2201, 99999, 2_147_483_648} {
		value := year
		_, err := h.service.CreateManualWork(context.Background(), library.ManualWorkInput{
			Title: "Frieren", Category: library.CategoryAnime, Year: &value,
		})

		require.ErrorIsf(t, err, library.ErrInvalidYear, "year %d", year)
	}
}

func TestCreateManualWorkAcceptsTheYearsAtTheEdgesOfTheRange(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	for _, year := range []int{1800, 2200} {
		value := year
		_, err := h.service.CreateManualWork(context.Background(), library.ManualWorkInput{
			Title: "Frieren", Category: library.CategoryAnime, Year: &value,
		})

		require.NoErrorf(t, err, "year %d", year)
	}
}

func TestCreateManualWorkRefusesASynopsisLongerThanTheContractAllows(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, err := h.service.CreateManualWork(context.Background(), library.ManualWorkInput{
		Title: "Frieren", Category: library.CategoryAnime, Synopsis: strings.Repeat("á", 5001),
	})

	require.ErrorIs(t, err, library.ErrInvalidSynopsis,
		"the bound is in characters, so an accent must not count double")
}

func TestAddToLibraryRefusesANoteLongerThanTheContractAllows(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	work := h.anime("Frieren", 28)
	note := strings.Repeat("á", 1001)

	_, err := h.service.AddToLibrary(context.Background(), uuid.New(), library.AddToLibraryInput{
		WorkID: work.ID, Status: library.StatusWishlist, Note: &note,
	})

	require.ErrorIs(t, err, library.ErrInvalidNote)
}

func TestUpdateEntryRefusesANoteLongerThanTheContractAllows(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	member := uuid.New()
	work := h.anime("Frieren", 28)
	entry := h.entries.Seed(library.Entry{
		MemberID: member, WorkID: work.ID, Status: library.StatusInProgress,
	})
	note := strings.Repeat("a", 1001)

	_, err := h.service.UpdateEntry(context.Background(), member, entry.ID, library.EntryPatch{
		Note: library.Set(&note),
	})

	require.ErrorIs(t, err, library.ErrInvalidNote)
}

func TestSearchWorksRefusesAQueryLongerThanTheContractAllows(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, _, err := h.service.SearchWorks(context.Background(),
		library.WorkFilter{Query: strings.Repeat("a", 201)}, nil, 25)

	require.ErrorIs(t, err, library.ErrInvalidFilter,
		"q is a query parameter, so it joins the invalid_filter family and not invalid_payload")
}
