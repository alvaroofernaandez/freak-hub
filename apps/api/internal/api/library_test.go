package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
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
