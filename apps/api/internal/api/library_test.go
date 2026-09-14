package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library"
)

// The wire shapes these tests hold the handlers to are the ones
// packages/contracts/openapi.yaml declares, field for field. "Exactly" is
// checked as a set of keys rather than by spot-reading a few of them,
// because a field nobody asked for is as much a contract break as a missing
// one: the web's types are generated from that file, and anything extra is
// an undocumented promise somebody will end up depending on.

// workFields is the Work schema's required list. The schema declares every
// property required, so an absent key is a break and an unknown key is one
// too.
var workFields = []string{
	"id", "title", "category", "source", "source_id", "cover_url", "synopsis",
	"year", "metadata", "expansion_of", "created_at", "updated_at",
}

// libraryEntryFields is the LibraryEntry schema's required list. member_id is
// deliberately absent: the entry is the caller's by construction, so echoing
// the owner back would be a field the contract never declared.
var libraryEntryFields = []string{
	"id", "work", "status", "progress", "rating", "is_favourite", "owned",
	"note", "started_at", "finished_at", "created_at", "updated_at",
}

// bodyKeys reads the top-level property names of a JSON object response.
func bodyKeys(t *testing.T, recorder *httptest.ResponseRecorder) []string {
	t.Helper()

	var body map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body), "body: %s", recorder.Body.String())

	keys := make([]string, 0, len(body))
	for key := range body {
		keys = append(keys, key)
	}

	sort.Strings(keys)

	return keys
}

// objectKeys does the same for a nested object, such as the work travelling
// inside a library entry.
func objectKeys(t *testing.T, raw json.RawMessage) []string {
	t.Helper()

	var object map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(raw, &object), "object: %s", string(raw))

	keys := make([]string, 0, len(object))
	for key := range object {
		keys = append(keys, key)
	}

	sort.Strings(keys)

	return keys
}

// seedAnime puts a finished anime in the shared catalogue, pinning the
// creation time so listing order does not depend on wall-clock timing.
func (s *suite) seedAnime(title string, at time.Time) library.Work {
	return s.works.Seed(library.Work{
		Title:    title,
		Category: library.CategoryAnime,
		Source:   library.SourceAniList,
		SourceID: title,
		Metadata: library.Metadata{library.MetadataKeyEpisodes: 26},
		CoverURL: "https://cdn.example/" + title + ".jpg",
		Synopsis: "A synopsis.",

		CreatedAt: at,
		UpdatedAt: at,
	})
}

// seedEntry registers a work in a member's library directly, bypassing the
// HTTP layer, so a test about reading or updating does not depend on the
// endpoint that creates.
func (s *suite) seedEntry(memberID, workID uuid.UUID, status library.Status, at time.Time) library.Entry {
	return s.entries.Seed(library.Entry{
		MemberID:  memberID,
		WorkID:    workID,
		Status:    status,
		CreatedAt: at,
		UpdatedAt: at,
	})
}

var seedTime = time.Date(2026, time.March, 1, 12, 0, 0, 0, time.UTC)

// ---------------------------------------------------------------------------
// GET /v1/works
// ---------------------------------------------------------------------------

func TestListWorksRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/works", "", nil)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
}

func TestListWorksAnswersThePageEnvelopeNewestFirst(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	oldest := s.seedAnime("Oldest", seedTime)
	newest := s.seedAnime("Newest", seedTime.Add(time.Hour))

	recorder := s.do(t, http.MethodGet, "/v1/works?limit=1", "valid-user_alex", nil)
	require.Equal(t, http.StatusOK, recorder.Code, "body: %s", recorder.Body.String())

	page := decode[struct {
		Items      []map[string]json.RawMessage `json:"items"`
		NextCursor *string                      `json:"next_cursor"`
	}](t, recorder)

	require.Len(t, page.Items, 1)
	assert.JSONEq(t, `"`+newest.ID.String()+`"`, string(page.Items[0]["id"]))
	require.NotNil(t, page.NextCursor, "a full page with more behind it hands back a cursor")

	second := s.do(t, http.MethodGet, "/v1/works?limit=1&cursor="+*page.NextCursor, "valid-user_alex", nil)
	require.Equal(t, http.StatusOK, second.Code)

	tail := decode[struct {
		Items      []map[string]json.RawMessage `json:"items"`
		NextCursor *string                      `json:"next_cursor"`
	}](t, second)

	require.Len(t, tail.Items, 1)
	assert.JSONEq(t, `"`+oldest.ID.String()+`"`, string(tail.Items[0]["id"]))
	assert.Nil(t, tail.NextCursor, "the last page hands back no cursor")
}

func TestListWorksKeepsOnlyTheCategoryAndTheQueryAsked(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	s.seedAnime("Kimetsu no Yaiba", seedTime)
	s.works.Seed(library.Work{
		Title: "Catan", Category: library.CategoryBoardGame, Source: library.SourceBGG,
		SourceID: "13", CreatedAt: seedTime, UpdatedAt: seedTime,
	})

	filtered := s.do(t, http.MethodGet, "/v1/works?category=boardgame", "valid-user_alex", nil)
	require.Equal(t, http.StatusOK, filtered.Code)

	page := decode[struct {
		Items []map[string]json.RawMessage `json:"items"`
	}](t, filtered)
	require.Len(t, page.Items, 1)
	assert.JSONEq(t, `"Catan"`, string(page.Items[0]["title"]))

	searched := s.do(t, http.MethodGet, "/v1/works?q=kimetsu", "valid-user_alex", nil)
	require.Equal(t, http.StatusOK, searched.Code)

	found := decode[struct {
		Items []map[string]json.RawMessage `json:"items"`
	}](t, searched)
	require.Len(t, found.Items, 1)
	assert.JSONEq(t, `"Kimetsu no Yaiba"`, string(found.Items[0]["title"]))
}

func TestListWorksRejectsACategoryOutsideTheEnum(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/works?category=vinyl", "valid-user_alex", nil)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_filter", errorCode(t, recorder),
		"an unknown filter is rejected, never answered with the unfiltered list")
}

func TestListWorksRejectsAnInvalidLimit(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	for _, limit := range []string{"0", "101", "abc"} {
		recorder := s.do(t, http.MethodGet, "/v1/works?limit="+limit, "valid-user_alex", nil)
		assert.Equalf(t, http.StatusBadRequest, recorder.Code, "limit %s", limit)
		assert.Equalf(t, "invalid_limit", errorCode(t, recorder), "limit %s", limit)
	}
}

func TestListWorksRejectsAnInvalidCursor(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/works?cursor=not-a-cursor", "valid-user_alex", nil)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_cursor", errorCode(t, recorder))
}

// ---------------------------------------------------------------------------
// POST /v1/works
// ---------------------------------------------------------------------------

func TestCreateWorkRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodPost, "/v1/works", "",
		map[string]any{"title": "Frieren", "category": "anime"})

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
}

func TestCreateWorkStampsTheManualSourceAndAnswersTheContractFields(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodPost, "/v1/works", "valid-user_alex", map[string]any{
		"title":    "  Frieren  ",
		"category": "anime",
		"metadata": map[string]any{"episodes": 28},
	})
	require.Equal(t, http.StatusCreated, recorder.Code, "body: %s", recorder.Body.String())

	assert.ElementsMatch(t, workFields, bodyKeys(t, recorder),
		"the Work response carries exactly the properties the contract declares")

	body := decode[map[string]any](t, recorder)
	assert.Equal(t, "Frieren", body["title"], "the title arrives trimmed")
	assert.Equal(t, "manual", body["source"])
	assert.Nil(t, body["source_id"], "a manual work points at no external record")
	assert.Nil(t, body["expansion_of"])
	assert.Nil(t, body["cover_url"])
	assert.Equal(t, map[string]any{"episodes": float64(28)}, body["metadata"])
}

func TestCreateWorkAnswersAnEmptyMetadataObjectRatherThanNull(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodPost, "/v1/works", "valid-user_alex",
		map[string]any{"title": "Frieren", "category": "anime"})
	require.Equal(t, http.StatusCreated, recorder.Code)

	body := decode[map[string]any](t, recorder)
	assert.Equal(t, map[string]any{}, body["metadata"],
		"metadata is a required, non-nullable object in the contract")
}

func TestCreateWorkRejectsAnUnknownField(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodPost, "/v1/works", "valid-user_alex", map[string]any{
		"title": "Frieren", "category": "anime", "source": "anilist",
	})

	assert.Equal(t, http.StatusBadRequest, recorder.Code,
		"source is not accepted: claiming a record came from AniList when nobody checked would poison the deduplication")
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

func TestCreateWorkRejectsATitleThatIsOnlyWhitespace(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodPost, "/v1/works", "valid-user_alex",
		map[string]any{"title": "   ", "category": "anime"})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

func TestCreateWorkRejectsACategoryOutsideTheEnum(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodPost, "/v1/works", "valid-user_alex",
		map[string]any{"title": "Frieren", "category": "vinyl"})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

// ---------------------------------------------------------------------------
// GET /v1/works/{id}
// ---------------------------------------------------------------------------

func TestGetWorkRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/works/"+uuid.New().String(), "", nil)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
}

func TestGetWorkReturnsAnyMembersWorkBecauseTheCatalogueIsShared(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodGet, "/v1/works/"+work.ID.String(), "valid-user_alex", nil)

	require.Equal(t, http.StatusOK, recorder.Code, "body: %s", recorder.Body.String())
	assert.ElementsMatch(t, workFields, bodyKeys(t, recorder))
	assert.Equal(t, "Frieren", decode[map[string]any](t, recorder)["title"])
}

func TestGetWorkIs404WhenNothingCarriesThatID(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/works/"+uuid.New().String(), "valid-user_alex", nil)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "work_not_found", errorCode(t, recorder))
}

func TestGetWorkIs404WhenThePathSegmentIsNotAUUID(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/works/not-a-uuid", "valid-user_alex", nil)

	assert.Equal(t, http.StatusNotFound, recorder.Code,
		"from the caller's side a malformed id and a missing one both mean there is nothing here")
	assert.Equal(t, "work_not_found", errorCode(t, recorder))
}

// ---------------------------------------------------------------------------
// GET /v1/library
// ---------------------------------------------------------------------------

func TestListLibraryRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/library", "", nil)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
}

func TestListLibraryIs404WhenTheSessionHasNoLocalMemberYet(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/library", "valid-user_ghost", nil)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "unknown_identity", errorCode(t, recorder),
		"the session is valid but the user.created webhook has not landed yet")
}

func TestListLibraryAnswersOnlyTheCallersOwnEntries(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	alvaro := s.seedMember(t, "user_alvaro", "alvaro")
	mine := s.seedAnime("Frieren", seedTime)
	theirs := s.seedAnime("Vinland Saga", seedTime)
	s.seedEntry(alex.ID, mine.ID, library.StatusInProgress, seedTime)
	s.seedEntry(alvaro.ID, theirs.ID, library.StatusCompleted, seedTime)

	recorder := s.do(t, http.MethodGet, "/v1/library", "valid-user_alex", nil)
	require.Equal(t, http.StatusOK, recorder.Code, "body: %s", recorder.Body.String())

	page := decode[struct {
		Items []map[string]json.RawMessage `json:"items"`
	}](t, recorder)

	require.Len(t, page.Items, 1, "a listing only ever walks the caller's own library")
	assert.JSONEq(t, `"Frieren"`, string(objectOf(t, page.Items[0]["work"])["title"]))
}

func TestListLibraryCarriesTheWholeWorkInlineAndTheContractFields(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodGet, "/v1/library", "valid-user_alex", nil)
	require.Equal(t, http.StatusOK, recorder.Code)

	page := decode[struct {
		Items []map[string]json.RawMessage `json:"items"`
	}](t, recorder)
	require.Len(t, page.Items, 1)

	entry := page.Items[0]
	keys := make([]string, 0, len(entry))
	for key := range entry {
		keys = append(keys, key)
	}

	sort.Strings(keys)
	assert.ElementsMatch(t, libraryEntryFields, keys,
		"member_id is not among them: the entry is the caller's by construction")
	assert.ElementsMatch(t, workFields, objectKeys(t, entry["work"]),
		"the whole work travels inline, so a library screen needs no second round of requests")
}

func TestListLibraryPagesNewestFirst(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	older := s.seedAnime("Older", seedTime)
	newer := s.seedAnime("Newer", seedTime)
	s.seedEntry(alex.ID, older.ID, library.StatusWishlist, seedTime)
	newest := s.seedEntry(alex.ID, newer.ID, library.StatusWishlist, seedTime.Add(time.Hour))

	recorder := s.do(t, http.MethodGet, "/v1/library?limit=1", "valid-user_alex", nil)
	require.Equal(t, http.StatusOK, recorder.Code)

	page := decode[struct {
		Items      []map[string]json.RawMessage `json:"items"`
		NextCursor *string                      `json:"next_cursor"`
	}](t, recorder)

	require.Len(t, page.Items, 1)
	assert.JSONEq(t, `"`+newest.ID.String()+`"`, string(page.Items[0]["id"]))
	require.NotNil(t, page.NextCursor)

	second := s.do(t, http.MethodGet, "/v1/library?limit=1&cursor="+*page.NextCursor, "valid-user_alex", nil)
	require.Equal(t, http.StatusOK, second.Code)

	tail := decode[struct {
		Items      []map[string]json.RawMessage `json:"items"`
		NextCursor *string                      `json:"next_cursor"`
	}](t, second)
	require.Len(t, tail.Items, 1)
	assert.Nil(t, tail.NextCursor)
}

func TestListLibraryKeepsOnlyTheStatusAndCategoryAsked(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	anime := s.seedAnime("Frieren", seedTime)
	game := s.works.Seed(library.Work{
		Title: "Catan", Category: library.CategoryBoardGame, Source: library.SourceBGG,
		SourceID: "13", CreatedAt: seedTime, UpdatedAt: seedTime,
	})
	s.seedEntry(alex.ID, anime.ID, library.StatusInProgress, seedTime)
	s.seedEntry(alex.ID, game.ID, library.StatusWishlist, seedTime)

	byStatus := s.do(t, http.MethodGet, "/v1/library?status=wishlist", "valid-user_alex", nil)
	require.Equal(t, http.StatusOK, byStatus.Code)

	wishlist := decode[struct {
		Items []map[string]json.RawMessage `json:"items"`
	}](t, byStatus)
	require.Len(t, wishlist.Items, 1)
	assert.JSONEq(t, `"Catan"`, string(objectOf(t, wishlist.Items[0]["work"])["title"]))

	byCategory := s.do(t, http.MethodGet, "/v1/library?category=anime", "valid-user_alex", nil)
	require.Equal(t, http.StatusOK, byCategory.Code)

	animeOnly := decode[struct {
		Items []map[string]json.RawMessage `json:"items"`
	}](t, byCategory)
	require.Len(t, animeOnly.Items, 1)
	assert.JSONEq(t, `"Frieren"`, string(objectOf(t, animeOnly.Items[0]["work"])["title"]))
}

func TestListLibraryRejectsAStatusOutsideTheEnum(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/library?status=abandonado", "valid-user_alex", nil)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_filter", errorCode(t, recorder),
		"answering the unfiltered list to somebody who asked for a slice looks like success")
}

func TestListLibraryRejectsACategoryOutsideTheEnum(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/library?category=vinyl", "valid-user_alex", nil)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_filter", errorCode(t, recorder))
}

func TestListLibraryRejectsAnInvalidLimit(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	for _, limit := range []string{"0", "101", "abc"} {
		recorder := s.do(t, http.MethodGet, "/v1/library?limit="+limit, "valid-user_alex", nil)
		assert.Equalf(t, http.StatusBadRequest, recorder.Code, "limit %s", limit)
		assert.Equalf(t, "invalid_limit", errorCode(t, recorder), "limit %s", limit)
	}
}

func TestListLibraryRejectsAnInvalidCursor(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/library?cursor=not-a-cursor", "valid-user_alex", nil)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_cursor", errorCode(t, recorder))
}

// ---------------------------------------------------------------------------
// POST /v1/library
// ---------------------------------------------------------------------------

func TestCreateLibraryEntryRequiresASession(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "",
		map[string]any{"work_id": work.ID.String(), "status": "wishlist"})

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
}

func TestCreateLibraryEntryRegistersTheWorkForTheSessionsMember(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex", map[string]any{
		"work_id": work.ID.String(), "status": "in_progress", "progress": 3,
	})
	require.Equal(t, http.StatusCreated, recorder.Code, "body: %s", recorder.Body.String())

	assert.ElementsMatch(t, libraryEntryFields, bodyKeys(t, recorder))

	body := decode[map[string]any](t, recorder)
	assert.Equal(t, "in_progress", body["status"])
	assert.InDelta(t, 3, body["progress"], 0)
	assert.Nil(t, body["rating"])

	stored, err := s.entries.ByMemberAndWork(t.Context(), alex.ID, work.ID)
	require.NoError(t, err, "the entry belongs to the member the session names")
	assert.Equal(t, alex.ID, stored.MemberID)
}

func TestCreateLibraryEntryRefusesAMemberIDSmuggledInTheBody(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	alvaro := s.seedMember(t, "user_alvaro", "alvaro")
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex", map[string]any{
		"work_id": work.ID.String(), "status": "wishlist", "member_id": alvaro.ID.String(),
	})

	assert.Equal(t, http.StatusBadRequest, recorder.Code,
		"accepting a member_id would be accepting a write into somebody else's library")
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

func TestCreateLibraryEntryIs404WhenTheWorkIsNotInTheCatalogue(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex",
		map[string]any{"work_id": uuid.New().String(), "status": "wishlist"})

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "work_not_found", errorCode(t, recorder))
}

func TestCreateLibraryEntryIs404WhenTheSessionHasNoLocalMemberYet(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_ghost",
		map[string]any{"work_id": work.ID.String(), "status": "wishlist"})

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "unknown_identity", errorCode(t, recorder))
}

func TestCreateLibraryEntryIs409WhenTheCallerAlreadyKeepsThatWork(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	s.seedEntry(alex.ID, work.ID, library.StatusWishlist, seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex",
		map[string]any{"work_id": work.ID.String(), "status": "pending"})

	assert.Equal(t, http.StatusConflict, recorder.Code,
		"watching something again is progress on the entry that exists, never a second row")
	assert.Equal(t, "already_in_library", errorCode(t, recorder))
}

func TestCreateLibraryEntryAcceptsAnyOfTheSixStatusesBecauseCreatingIsNotATransition(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	for _, status := range []string{"wishlist", "pending", "in_progress", "completed", "dropped", "on_hold"} {
		work := s.seedAnime("Anime "+status, seedTime)

		recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex",
			map[string]any{"work_id": work.ID.String(), "status": status})

		require.Equalf(t, http.StatusCreated, recorder.Code, "status %s: %s", status, recorder.Body.String())
	}
}

func TestCreateLibraryEntryRefusesARatingOnAStatusWithNoOpinionBehindIt(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex",
		map[string]any{"work_id": work.ID.String(), "status": "in_progress", "rating": 8})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code,
		"creation has nothing stored for an incoming rating to match, so the plain rule applies")
	assert.Equal(t, "rating_not_allowed", errorCode(t, recorder))
}

func TestCreateLibraryEntryKeepsARatingOnACompletedEntry(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex",
		map[string]any{"work_id": work.ID.String(), "status": "completed", "rating": 9})

	require.Equal(t, http.StatusCreated, recorder.Code, "body: %s", recorder.Body.String())
	assert.InDelta(t, 9, decode[map[string]any](t, recorder)["rating"], 0)
}

func TestCreateLibraryEntryRejectsProgressBeyondTheWorksTotal(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex",
		map[string]any{"work_id": work.ID.String(), "status": "in_progress", "progress": 999})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code)
	assert.Equal(t, "invalid_progress", errorCode(t, recorder))
}

func TestCreateLibraryEntryRejectsAStatusOutsideTheEnum(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex",
		map[string]any{"work_id": work.ID.String(), "status": "abandonado"})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

func TestCreateLibraryEntryRejectsARatingOutsideOneToTen(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex",
		map[string]any{"work_id": work.ID.String(), "status": "completed", "rating": 11})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

func TestCreateLibraryEntryRejectsAWorkIDThatIsNotAUUID(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex",
		map[string]any{"work_id": "not-a-uuid", "status": "wishlist"})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

// objectOf decodes a nested JSON object into its raw properties.
func objectOf(t *testing.T, raw json.RawMessage) map[string]json.RawMessage {
	t.Helper()

	var object map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(raw, &object), "object: %s", string(raw))

	return object
}

// ---------------------------------------------------------------------------
// GET · PATCH · DELETE /v1/library/{id}
//
// These are the three routes where auth.Middleware is not enough: it says the
// caller is somebody, never that the entry is theirs. Every one of them goes
// through library.Service, whose ownedEntry check answers somebody else's
// entry exactly like a missing one — 404, never 403, because a 403 confirms
// the id is real.
// ---------------------------------------------------------------------------

// ratedEntry seeds an entry that already carries a score, which is what the
// PATCH rating rules are argued about.
func (s *suite) ratedEntry(memberID, workID uuid.UUID, status library.Status, rating int) library.Entry {
	return s.entries.Seed(library.Entry{
		MemberID:  memberID,
		WorkID:    workID,
		Status:    status,
		Rating:    &rating,
		CreatedAt: seedTime,
		UpdatedAt: seedTime,
	})
}

func TestGetLibraryEntryRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/library/"+uuid.New().String(), "", nil)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
}

func TestGetLibraryEntryReturnsTheCallersOwnEntry(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodGet, "/v1/library/"+entry.ID.String(), "valid-user_alex", nil)

	require.Equal(t, http.StatusOK, recorder.Code, "body: %s", recorder.Body.String())
	assert.ElementsMatch(t, libraryEntryFields, bodyKeys(t, recorder))
	assert.Equal(t, entry.ID.String(), decode[map[string]any](t, recorder)["id"])
}

func TestGetLibraryEntryIs404ForAnotherMembersEntry(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	alvaro := s.seedMember(t, "user_alvaro", "alvaro")
	work := s.seedAnime("Frieren", seedTime)
	theirs := s.seedEntry(alvaro.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodGet, "/v1/library/"+theirs.ID.String(), "valid-user_alex", nil)

	assert.NotEqual(t, http.StatusForbidden, recorder.Code,
		"a 403 would confirm that identifier names a real entry")
	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "library_entry_not_found", errorCode(t, recorder))
}

// TestTheThreeEntryRoutesAnswerAnotherMembersEntryExactlyLikeAMissingOne
// compares the whole body, not just the status and the code, and does it on
// all three verbs.
//
// The parity holds today on every one of them, and the reason to assert it
// three times rather than once is that nothing would catch it breaking on
// the other two: a detail written per handler, or a field_errors entry added
// to one code and not another, is a difference a caller can measure — and
// measuring a difference is how you learn which uuids are real.
func TestTheThreeEntryRoutesAnswerAnotherMembersEntryExactlyLikeAMissingOne(t *testing.T) {
	t.Parallel()

	probes := []struct {
		method string
		body   any
	}{
		{http.MethodGet, nil},
		{http.MethodPatch, map[string]any{"progress": 12}},
		{http.MethodDelete, nil},
	}

	for _, probe := range probes {
		s := newSuite(t)
		s.seedMember(t, "user_alex", "alex")
		alvaro := s.seedMember(t, "user_alvaro", "alvaro")
		work := s.seedAnime("Frieren", seedTime)
		theirs := s.seedEntry(alvaro.ID, work.ID, library.StatusInProgress, seedTime)

		someoneElses := s.do(t, probe.method, "/v1/library/"+theirs.ID.String(), "valid-user_alex", probe.body)
		neverExisted := s.do(t, probe.method, "/v1/library/"+uuid.NewString(), "valid-user_alex", probe.body)
		malformed := s.do(t, probe.method, "/v1/library/not-a-uuid", "valid-user_alex", probe.body)

		assert.Equalf(t, http.StatusNotFound, someoneElses.Code, "%s", probe.method)
		assert.Equalf(t, someoneElses.Code, neverExisted.Code, "%s", probe.method)
		assert.Equalf(t, someoneElses.Code, malformed.Code, "%s", probe.method)

		assert.Equalf(t, problemWithoutInstance(t, someoneElses), problemWithoutInstance(t, neverExisted),
			"%s: walking uuids must not tell anybody which ones are real", probe.method)
		assert.Equalf(t, problemWithoutInstance(t, someoneElses), problemWithoutInstance(t, malformed),
			"%s: a malformed id is not a third answer either", probe.method)

		assert.NotContainsf(t, someoneElses.Body.String(), "field_errors",
			"%s: a blamed field would be one more thing to read a difference out of", probe.method)

		untouched, err := s.entries.ByID(t.Context(), theirs.ID)
		require.NoErrorf(t, err, "%s: somebody else's entry is still there", probe.method)
		assert.Equalf(t, 0, untouched.Progress, "%s: and nothing of it was written", probe.method)
	}
}

func TestGetLibraryEntryIs404WhenNothingCarriesThatID(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/library/"+uuid.New().String(), "valid-user_alex", nil)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "library_entry_not_found", errorCode(t, recorder))
}

func TestGetLibraryEntryIs404WhenThePathSegmentIsNotAUUID(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/library/not-a-uuid", "valid-user_alex", nil)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "library_entry_not_found", errorCode(t, recorder))
}

func TestGetLibraryEntryIs404WhenTheSessionHasNoLocalMemberYet(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/library/"+uuid.New().String(), "valid-user_ghost", nil)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "unknown_identity", errorCode(t, recorder))
}

func TestUpdateLibraryEntryRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodPatch, "/v1/library/"+uuid.New().String(), "",
		map[string]any{"progress": 1})

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
}

func TestUpdateLibraryEntryIs404ForAnotherMembersEntry(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	alvaro := s.seedMember(t, "user_alvaro", "alvaro")
	work := s.seedAnime("Frieren", seedTime)
	theirs := s.seedEntry(alvaro.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+theirs.ID.String(), "valid-user_alex",
		map[string]any{"progress": 12})

	assert.NotEqual(t, http.StatusForbidden, recorder.Code)
	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "library_entry_not_found", errorCode(t, recorder))

	untouched, err := s.entries.ByID(t.Context(), theirs.ID)
	require.NoError(t, err)
	assert.Equal(t, 0, untouched.Progress, "nothing of somebody else's entry was written")
}

func TestUpdateLibraryEntryAdvancesTheProgress(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"progress": 12})

	require.Equal(t, http.StatusOK, recorder.Code, "body: %s", recorder.Body.String())
	assert.ElementsMatch(t, libraryEntryFields, bodyKeys(t, recorder))
	assert.InDelta(t, 12, decode[map[string]any](t, recorder)["progress"], 0)
}

func TestUpdateLibraryEntryLeavesAnAbsentPropertyAlone(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.ratedEntry(alex.ID, work.ID, library.StatusCompleted, 8)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"is_favourite": true})

	require.Equal(t, http.StatusOK, recorder.Code, "body: %s", recorder.Body.String())

	body := decode[map[string]any](t, recorder)
	assert.Equal(t, true, body["is_favourite"])
	assert.InDelta(t, 8, body["rating"], 0, "a rating nobody mentioned is left where it was")
}

func TestUpdateLibraryEntryClearsARatingWithAnExplicitNull(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.ratedEntry(alex.ID, work.ID, library.StatusCompleted, 8)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"rating": nil})

	require.Equal(t, http.StatusOK, recorder.Code, "body: %s", recorder.Body.String())
	assert.Nil(t, decode[map[string]any](t, recorder)["rating"],
		"an explicit null is how a score is removed; absent and null cannot mean the same thing")

	stored, err := s.entries.ByID(t.Context(), entry.ID)
	require.NoError(t, err)
	assert.Nil(t, stored.Rating)
}

func TestUpdateLibraryEntryClearsANoteWithAnExplicitNull(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	note := "Empezado con Álvaro."
	entry := s.entries.Seed(library.Entry{
		MemberID: alex.ID, WorkID: work.ID, Status: library.StatusInProgress,
		Note: &note, CreatedAt: seedTime, UpdatedAt: seedTime,
	})

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"note": nil})

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Nil(t, decode[map[string]any](t, recorder)["note"])
}

func TestUpdateLibraryEntryKeepsAStoredRatingWhenTheStatusChanges(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.ratedEntry(alex.ID, work.ID, library.StatusCompleted, 8)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"status": "in_progress"})

	require.Equal(t, http.StatusOK, recorder.Code, "body: %s", recorder.Body.String())

	body := decode[map[string]any](t, recorder)
	assert.Equal(t, "in_progress", body["status"])
	assert.InDelta(t, 8, body["rating"], 0,
		"a rewatch is not a reason to destroy a score, and there is no history to restore it from")
}

func TestUpdateLibraryEntryAcceptsTheStoredRatingSentBackUnchanged(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.ratedEntry(alex.ID, work.ID, library.StatusInProgress, 8)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"rating": 8})

	assert.Equal(t, http.StatusOK, recorder.Code,
		"the rule guards a change of score; handing back the object this API just returned asks for nothing")
}

func TestUpdateLibraryEntryRefusesADifferentRatingOnAStatusWithNoOpinionBehindIt(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"rating": 9})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code)
	assert.Equal(t, "rating_not_allowed", errorCode(t, recorder))
}

func TestUpdateLibraryEntryRefusesAMoveTheStateMachineDoesNotDraw(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusWishlist, seedTime)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"status": "completed"})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code,
		"a status in a PATCH is a transition, unlike a status at creation")
	assert.Equal(t, "invalid_transition", errorCode(t, recorder))
}

func TestUpdateLibraryEntryRefusesProgressBeyondTheWorksTotal(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"progress": 999})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code)
	assert.Equal(t, "invalid_progress", errorCode(t, recorder))
}

func TestUpdateLibraryEntryRejectsAnUnknownProperty(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"work_id": uuid.New().String()})

	assert.Equal(t, http.StatusBadRequest, recorder.Code,
		"an entry never changes the work it points at: that is a different entry")
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

func TestUpdateLibraryEntryRejectsANullOnAPropertyTheContractDeclaresNonNullable(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	for _, property := range []string{"status", "progress", "is_favourite", "owned"} {
		recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
			map[string]any{property: nil})

		assert.Equalf(t, http.StatusBadRequest, recorder.Code,
			"%s is not nullable, so clearing it means nothing: %s", property, recorder.Body.String())
		assert.Equalf(t, "invalid_payload", errorCode(t, recorder), "property %s", property)
	}
}

func TestUpdateLibraryEntryRejectsAStatusOutsideTheEnum(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"status": "abandonado"})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

func TestUpdateLibraryEntryWithNoPropertiesLeavesEvenTheTimestampAlone(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{})

	require.Equal(t, http.StatusOK, recorder.Code, "body: %s", recorder.Body.String())
	assert.Equal(t, entry.UpdatedAt.UTC().Format(time.RFC3339), decode[map[string]any](t, recorder)["updated_at"],
		"the activity feed reads updated_at, so moving it would announce a change nobody made")
}

func TestDeleteLibraryEntryRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodDelete, "/v1/library/"+uuid.New().String(), "", nil)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
}

func TestDeleteLibraryEntryRemovesTheRelationshipAndLeavesTheWorkInTheCatalogue(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusDropped, seedTime)

	recorder := s.do(t, http.MethodDelete, "/v1/library/"+entry.ID.String(), "valid-user_alex", nil)

	require.Equal(t, http.StatusNoContent, recorder.Code, "body: %s", recorder.Body.String())
	assert.Empty(t, recorder.Body.String())

	_, err := s.entries.ByID(t.Context(), entry.ID)
	require.ErrorIs(t, err, library.ErrEntryNotFound)

	_, err = s.works.ByID(t.Context(), work.ID)
	require.NoError(t, err, "what leaves is the relationship; the work is shared history")
}

func TestDeleteLibraryEntryIs404ForAnotherMembersEntry(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	alvaro := s.seedMember(t, "user_alvaro", "alvaro")
	work := s.seedAnime("Frieren", seedTime)
	theirs := s.seedEntry(alvaro.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodDelete, "/v1/library/"+theirs.ID.String(), "valid-user_alex", nil)

	assert.NotEqual(t, http.StatusForbidden, recorder.Code)
	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "library_entry_not_found", errorCode(t, recorder))

	_, err := s.entries.ByID(t.Context(), theirs.ID)
	require.NoError(t, err, "somebody else's entry is still there")
}

func TestDeleteLibraryEntryIs404TheSecondTime(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	require.Equal(t, http.StatusNoContent,
		s.do(t, http.MethodDelete, "/v1/library/"+entry.ID.String(), "valid-user_alex", nil).Code)

	again := s.do(t, http.MethodDelete, "/v1/library/"+entry.ID.String(), "valid-user_alex", nil)

	assert.Equal(t, http.StatusNotFound, again.Code)
	assert.Equal(t, "library_entry_not_found", errorCode(t, again))
}

// problemWithoutInstance reads a Problem body and drops `instance`, which is
// the request path and therefore differs between two requests by
// construction. What is left is everything a caller could tell two answers
// apart by.
func problemWithoutInstance(t *testing.T, recorder *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var body map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body), "body: %s", recorder.Body.String())

	delete(body, "instance")
	delete(body, "correlation_id")

	return body
}

// ---------------------------------------------------------------------------
// The bounds the contract declares.
//
// Two of these used to be a 500 an ordinary client could reach: the int4
// column underneath year and progress cannot hold what the domain let
// through, the adapter refused to truncate it — rightly — and the refusal
// had no code to travel as. The other four were merely permissive, which is
// how a 60000-character synopsis got stored.
// ---------------------------------------------------------------------------

// seedAiringAnime puts an anime with no known episode count in the catalogue.
// Domain rule 5 caps nothing for it, which is what makes it the case where
// progress has no ceiling but the storage still does — and what a manual work
// created with no metadata looks like.
func (s *suite) seedAiringAnime(title string) library.Work {
	return s.works.Seed(library.Work{
		Title:    title,
		Category: library.CategoryAnime,
		Source:   library.SourceManual,
		Metadata: library.Metadata{"status_airing": "airing"},

		CreatedAt: seedTime,
		UpdatedAt: seedTime,
	})
}

func TestCreateWorkRejectsAYearNoColumnCouldHold(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	for _, year := range []any{99999, 2147483648} {
		recorder := s.do(t, http.MethodPost, "/v1/works", "valid-user_alex",
			map[string]any{"title": "Y", "category": "anime", "year": year})

		assert.Equalf(t, http.StatusBadRequest, recorder.Code,
			"year %v is a well-formed request and must not answer 500: %s", year, recorder.Body.String())
		assert.Equalf(t, "invalid_payload", errorCode(t, recorder), "year %v", year)
	}
}

func TestCreateWorkRejectsASynopsisLongerThanTheContractAllows(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodPost, "/v1/works", "valid-user_alex", map[string]any{
		"title": "Frieren", "category": "anime", "synopsis": strings.Repeat("a", 5001),
	})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

func TestListWorksRejectsAQueryLongerThanTheContractAllows(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/works?q="+strings.Repeat("a", 201), "valid-user_alex", nil)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_filter", errorCode(t, recorder),
		"q travels in the query string, and invalid_payload means the body is not valid")
}

func TestCreateLibraryEntryRejectsProgressNoColumnCouldHold(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	work := s.seedAiringAnime("Airing")

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex", map[string]any{
		"work_id": work.ID.String(), "status": "in_progress", "progress": 3000000000,
	})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code,
		"a work with no known total has no rule-5 ceiling, and the column's is the one left: "+
			recorder.Body.String())
	assert.Equal(t, "invalid_progress", errorCode(t, recorder))
}

func TestUpdateLibraryEntryRejectsProgressNoColumnCouldHold(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAiringAnime("Airing")
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"progress": 3000000000})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code)
	assert.Equal(t, "invalid_progress", errorCode(t, recorder))
}

func TestCreateLibraryEntryRejectsANoteLongerThanTheContractAllows(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)

	recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex", map[string]any{
		"work_id": work.ID.String(), "status": "wishlist", "note": strings.Repeat("a", 1001),
	})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

func TestUpdateLibraryEntryRejectsANoteLongerThanTheContractAllows(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	alex := s.seedMember(t, "user_alex", "alex")
	work := s.seedAnime("Frieren", seedTime)
	entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

	recorder := s.do(t, http.MethodPatch, "/v1/library/"+entry.ID.String(), "valid-user_alex",
		map[string]any{"note": strings.Repeat("a", 1001)})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}

// TestCreateLibraryEntryRejectsANullOnAPropertyTheContractDeclaresNonNullable
// closes the asymmetry: PATCH refused these and POST read them as absent.
// Landing on the contract's defaults made it harmless, which is exactly why
// it would have survived until a default changed.
func TestCreateLibraryEntryRejectsANullOnAPropertyTheContractDeclaresNonNullable(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	for _, property := range []string{"status", "progress", "is_favourite", "owned"} {
		work := s.seedAnime("Anime "+property, seedTime)
		body := map[string]any{"work_id": work.ID.String(), "status": "wishlist"}
		body[property] = nil

		recorder := s.do(t, http.MethodPost, "/v1/library", "valid-user_alex", body)

		assert.Equalf(t, http.StatusBadRequest, recorder.Code,
			"%s is not nullable: %s", property, recorder.Body.String())
		assert.Equalf(t, "invalid_payload", errorCode(t, recorder), "property %s", property)
	}
}

// TestNoRouteAcceptsANullCharacterInClientText covers the eight places
// client text reaches a text or jsonb column across these routes. Postgres
// stores U+0000 in neither — 22021 for text, 22P05 for the escape inside
// jsonb — and Go carries it inside a string without complaint, so nothing
// upstream notices until the request has already reached the database.
//
// The last row is a read. Nothing is written and the failure happened
// anyway, which is what makes "it does not corrupt anything" the wrong
// reason to leave it alone.
func TestNoRouteAcceptsANullCharacterInClientText(t *testing.T) {
	t.Parallel()

	const nul = "a\x00b"

	probes := []struct {
		name   string
		method string
		path   string
		body   func(work, entry uuid.UUID) any
		code   string
	}{
		{"a title", http.MethodPost, "/v1/works", func(uuid.UUID, uuid.UUID) any {
			return map[string]any{"title": nul, "category": "anime"}
		}, "invalid_payload"},
		{"a synopsis", http.MethodPost, "/v1/works", func(uuid.UUID, uuid.UUID) any {
			return map[string]any{"title": "S", "category": "anime", "synopsis": nul}
		}, "invalid_payload"},
		{"a cover url", http.MethodPost, "/v1/works", func(uuid.UUID, uuid.UUID) any {
			return map[string]any{"title": "C", "category": "anime", "cover_url": "http://" + nul}
		}, "invalid_payload"},
		{"a metadata value", http.MethodPost, "/v1/works", func(uuid.UUID, uuid.UUID) any {
			return map[string]any{"title": "M", "category": "anime", "metadata": map[string]any{"k": nul}}
		}, "invalid_payload"},
		{"a metadata key", http.MethodPost, "/v1/works", func(uuid.UUID, uuid.UUID) any {
			return map[string]any{"title": "K", "category": "anime", "metadata": map[string]any{nul: 1}}
		}, "invalid_payload"},
		{"a nested metadata value", http.MethodPost, "/v1/works", func(uuid.UUID, uuid.UUID) any {
			return map[string]any{"title": "N", "category": "anime",
				"metadata": map[string]any{"studio": map[string]any{"name": nul}}}
		}, "invalid_payload"},
		{"a note at creation", http.MethodPost, "/v1/library", func(work, _ uuid.UUID) any {
			return map[string]any{"work_id": work.String(), "status": "wishlist", "note": nul}
		}, "invalid_payload"},
		{"a note in an update", http.MethodPatch, "", func(uuid.UUID, uuid.UUID) any {
			return map[string]any{"note": nul}
		}, "invalid_payload"},
	}

	for _, probe := range probes {
		s := newSuite(t)
		alex := s.seedMember(t, "user_alex", "alex")
		work := s.seedAnime("Host "+probe.name, seedTime)
		entry := s.seedEntry(alex.ID, work.ID, library.StatusInProgress, seedTime)

		path := probe.path
		if path == "" {
			path = "/v1/library/" + entry.ID.String()
		}

		recorder := s.do(t, probe.method, path, "valid-user_alex", probe.body(work.ID, entry.ID))

		assert.NotEqualf(t, http.StatusInternalServerError, recorder.Code,
			"a null character in %s answered 500", probe.name)
		assert.Equalf(t, http.StatusBadRequest, recorder.Code, "%s: %s", probe.name, recorder.Body.String())
		assert.Equalf(t, probe.code, errorCode(t, recorder), "%s", probe.name)
	}
}

func TestListWorksRejectsASearchQueryCarryingANullCharacter(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.do(t, http.MethodGet, "/v1/works?q=a%00b", "valid-user_alex", nil)

	assert.NotEqual(t, http.StatusInternalServerError, recorder.Code)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_filter", errorCode(t, recorder),
		"q travels in the query string, so it stays in the invalid_filter family")
}

// TestCreateWorkRejectsASecondDocumentAfterTheBody is the route-level half of
// the httpx change: two concatenated documents used to answer 201, with the
// second quietly unread. The fix is shared, so PATCH /v1/me and
// POST /v1/invitations gain it too.
func TestCreateWorkRejectsASecondDocumentAfterTheBody(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_alex", "alex")

	recorder := s.doRaw(t, http.MethodPost, "/v1/works", "valid-user_alex",
		`{"title":"a","category":"anime"}{"title":"b","category":"anime"}`)

	assert.Equal(t, http.StatusBadRequest, recorder.Code,
		"a partial success that looks like a whole one is what principle 4 exists to prevent")
	assert.Equal(t, "invalid_payload", errorCode(t, recorder))
}
