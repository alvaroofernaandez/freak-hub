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
