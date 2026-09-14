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
	clock   time.Time
}

func newHarness(t *testing.T) *harness {
	t.Helper()

	works := librarymem.NewWorkRepository()
	h := &harness{
		works: works,
		clock: time.Date(2026, time.March, 1, 12, 0, 0, 0, time.UTC),
	}
	works.NowFunc = func() time.Time { return h.clock }
	h.service = library.NewService(library.ServiceDeps{Works: works})

	return h
}

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
