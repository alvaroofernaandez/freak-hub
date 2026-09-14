package postgres_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/api"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/auth"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/postgres"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// This is the acceptance test the library epic is closed against: a member
// registers an anime, advances through it, rates it and puts it down, over
// real HTTP, through the real router, against a real Postgres. Everything
// between the socket and the table is production code.
//
// The one substitution is Clerk. Verifying a session means checking a JWT
// against Clerk's JWKS, which needs a browser sign-in and a live tenant, so
// the verifier here accepts "valid-<clerk id>" and the member it names is a
// real row in the members table. What that does not fake is any of what this
// test is about: the routing, the session middleware, the owner check, the
// domain rules, the SQL and the wire shapes are all the ones that ship.
//
// It lives in this package because this is the only one CI runs with a
// database behind it. Somewhere tidier would mean a package CI never reaches,
// and a test nothing runs proves nothing.

// journeyVerifier accepts "valid-<clerk id>", which is the stand-in for a
// Clerk session described above.
type journeyVerifier struct{}

func (journeyVerifier) Verify(_ context.Context, token string) (auth.Identity, error) {
	const prefix = "valid-"

	clerkID, found := strings.CutPrefix(token, prefix)
	if !found || clerkID == "" {
		return auth.Identity{}, errUnverifiableToken
	}

	return auth.Identity{ClerkUserID: clerkID, SessionID: "sess_journey"}, nil
}

var errUnverifiableToken = errors.New("token does not verify")

// journeyClient drives the API the way the web will: one base URL, one
// bearer token, JSON in and JSON out.
type journeyClient struct {
	t     *testing.T
	base  string
	token string
}

// call sends one request and hands back the status and the decoded body.
// body may be nil for a request that carries none.
func (c *journeyClient) call(method, path string, body any) (int, map[string]any) {
	c.t.Helper()

	var reader io.Reader

	if body != nil {
		raw, err := json.Marshal(body)
		require.NoError(c.t, err)
		reader = bytes.NewReader(raw)
	}

	request, err := http.NewRequestWithContext(c.t.Context(), method, c.base+path, reader)
	require.NoError(c.t, err)
	request.Header.Set("Authorization", "Bearer "+c.token)
	request.Header.Set("Content-Type", "application/json")

	response, err := http.DefaultClient.Do(request)
	require.NoError(c.t, err)

	defer func() {
		_ = response.Body.Close()
	}()

	raw, err := io.ReadAll(response.Body)
	require.NoError(c.t, err)

	assert.NotEmpty(c.t, response.Header.Get("X-Request-ID"),
		"every response carries the correlation id, success or error")

	if len(raw) == 0 {
		return response.StatusCode, nil
	}

	var decoded map[string]any
	require.NoErrorf(c.t, json.Unmarshal(raw, &decoded), "%s %s: %s", method, path, raw)

	return response.StatusCode, decoded
}

// journeyAPI stands the whole API up over pool, Postgres-backed end to end.
func journeyAPI(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()

	members := postgres.NewMemberRepository(pool)
	router := api.NewRouter(api.Deps{
		Users: users.NewService(members),
		Library: library.NewService(library.ServiceDeps{
			Works:   postgres.NewWorkRepository(pool),
			Entries: postgres.NewEntryRepository(pool),
		}),
		Verifier:       journeyVerifier{},
		AllowedOrigins: []string{"http://localhost:3000"},
	})

	server := httptest.NewServer(router)
	t.Cleanup(server.Close)

	return server.URL
}

func TestAMemberRegistersAnAnimeAdvancesItAndRatesItAgainstARealDatabase(t *testing.T) {
	pool := libraryDB(t, nil)
	base := journeyAPI(t, pool)

	seedMember(t, pool, "alvaro")
	seedMember(t, pool, "alex")
	alvaro := &journeyClient{t: t, base: base, token: "valid-alvaro"}
	alex := &journeyClient{t: t, base: base, token: "valid-alex"}

	// Nobody gets in without a session, not even to the shared catalogue.
	stranger := &journeyClient{t: t, base: base, token: "not-a-session"}
	status, refused := stranger.call(http.MethodGet, "/v1/works", nil)
	require.Equal(t, http.StatusUnauthorized, status)
	require.Equal(t, "invalid_token", refused["code"])

	// 1. No catalogue lists it, so it goes in by hand.
	status, work := alvaro.call(http.MethodPost, "/v1/works", map[string]any{
		"title":    "Frieren: Beyond Journey's End",
		"category": "anime",
		"year":     2023,
		"metadata": map[string]any{"episodes": 28},
	})
	require.Equalf(t, http.StatusCreated, status, "%v", work)
	assert.Equal(t, "manual", work["source"])
	assert.Nil(t, work["source_id"])

	workID, ok := work["id"].(string)
	require.True(t, ok)

	// 2. And it is findable, which is what makes manual entry survivable
	// without deduplication.
	status, found := alvaro.call(http.MethodGet, "/v1/works?q=frieren&category=anime", nil)
	require.Equal(t, http.StatusOK, status)
	require.Len(t, found["items"], 1)

	// 3. Onto the shelf, still unseen.
	status, entry := alvaro.call(http.MethodPost, "/v1/library", map[string]any{
		"work_id": workID, "status": "pending",
	})
	require.Equalf(t, http.StatusCreated, status, "%v", entry)

	entryID, ok := entry["id"].(string)
	require.True(t, ok)

	// 4. Domain rule 1: the same work never lands twice.
	status, conflict := alvaro.call(http.MethodPost, "/v1/library",
		map[string]any{"work_id": workID, "status": "wishlist"})
	require.Equal(t, http.StatusConflict, status)
	assert.Equal(t, "already_in_library", conflict["code"])

	// 5. Watching starts, and the episodes add up.
	status, started := alvaro.call(http.MethodPatch, "/v1/library/"+entryID,
		map[string]any{"status": "in_progress"})
	require.Equalf(t, http.StatusOK, status, "%v", started)

	status, advanced := alvaro.call(http.MethodPatch, "/v1/library/"+entryID,
		map[string]any{"progress": 12})
	require.Equalf(t, http.StatusOK, status, "%v", advanced)
	assert.InDelta(t, 12, advanced["progress"], 0)

	// 6. Domain rule 5: 999 episodes of a 28-episode run do not exist.
	status, tooFar := alvaro.call(http.MethodPatch, "/v1/library/"+entryID,
		map[string]any{"progress": 999})
	require.Equal(t, http.StatusUnprocessableEntity, status)
	assert.Equal(t, "invalid_progress", tooFar["code"])

	// 7. Domain rule 2: a score means nothing before the opinion exists.
	status, tooSoon := alvaro.call(http.MethodPatch, "/v1/library/"+entryID,
		map[string]any{"rating": 9})
	require.Equal(t, http.StatusUnprocessableEntity, status)
	assert.Equal(t, "rating_not_allowed", tooSoon["code"])

	// 8. Finished, and rated in the same breath — the ordinary case.
	status, finished := alvaro.call(http.MethodPatch, "/v1/library/"+entryID,
		map[string]any{"status": "completed", "rating": 9, "is_favourite": true})
	require.Equalf(t, http.StatusOK, status, "%v", finished)
	assert.Equal(t, "completed", finished["status"])
	assert.InDelta(t, 9, finished["rating"], 0)

	// 9. The library reads back with the work inline, so a screen renders in
	// one round trip.
	status, shelf := alvaro.call(http.MethodGet, "/v1/library?status=completed", nil)
	require.Equal(t, http.StatusOK, status)

	items, ok := shelf["items"].([]any)
	require.True(t, ok)
	require.Len(t, items, 1)

	first, ok := items[0].(map[string]any)
	require.True(t, ok)

	inlineWork, ok := first["work"].(map[string]any)
	require.True(t, ok, "the whole work travels inside the entry")
	assert.Equal(t, "Frieren: Beyond Journey's End", inlineWork["title"])
	assert.Nil(t, shelf["next_cursor"])

	// 10. Somebody else's entry is not there, and cannot be told apart from
	// one that never existed.
	status, denied := alex.call(http.MethodGet, "/v1/library/"+entryID, nil)
	require.Equal(t, http.StatusNotFound, status, "a 403 would confirm the id is real")
	assert.Equal(t, "library_entry_not_found", denied["code"])

	statusMissing, missing := alex.call(http.MethodGet, "/v1/library/"+uuid.NewString(), nil)
	assert.Equal(t, status, statusMissing)
	assert.Equal(t, denied["code"], missing["code"])
	assert.Equal(t, denied["detail"], missing["detail"])

	// 11. And the score comes off again, which only an explicit null can ask
	// for.
	status, unrated := alvaro.call(http.MethodPatch, "/v1/library/"+entryID,
		map[string]any{"rating": nil})
	require.Equalf(t, http.StatusOK, status, "%v", unrated)
	assert.Nil(t, unrated["rating"])
	assert.Equal(t, true, unrated["is_favourite"], "a property nobody mentioned stayed where it was")

	// 12. Off the shelf. The relationship goes; the shared history stays.
	status, _ = alvaro.call(http.MethodDelete, "/v1/library/"+entryID, nil)
	require.Equal(t, http.StatusNoContent, status)

	status, gone := alvaro.call(http.MethodGet, "/v1/library/"+entryID, nil)
	require.Equal(t, http.StatusNotFound, status)
	assert.Equal(t, "library_entry_not_found", gone["code"])

	status, stillCatalogued := alvaro.call(http.MethodGet, "/v1/works/"+workID, nil)
	require.Equal(t, http.StatusOK, status, "a work is never deleted, even when nobody keeps it")
	assert.Equal(t, workID, stillCatalogued["id"])
}

// TestAWellFormedRequestNeverReachesTheInt4CeilingAsA500 is the regression
// test for the one failure the in-memory double cannot reproduce: it stores
// a Go int, so only a real int4 column refuses. The adapter is right to
// refuse rather than truncate — a rating of 4294967297 stored as 1 would be
// a valid score — but a bare error there falls to the 500 branch, and both
// of these are ordinary requests a client can send by accident.
//
// year is reachable straight from POST /v1/works. progress is reachable
// whenever the work has no known total, which is exactly what POST /v1/works
// creates when nobody types an episode count in.
func TestAWellFormedRequestNeverReachesTheInt4CeilingAsA500(t *testing.T) {
	pool := libraryDB(t, nil)
	base := journeyAPI(t, pool)

	seedMember(t, pool, "alvaro")
	alvaro := &journeyClient{t: t, base: base, token: "valid-alvaro"}

	status, problem := alvaro.call(http.MethodPost, "/v1/works", map[string]any{
		"title": "Out of range", "category": "anime", "year": 2147483648,
	})
	require.Equalf(t, http.StatusBadRequest, status, "%v", problem)
	assert.Equal(t, "invalid_payload", problem["code"])

	status, work := alvaro.call(http.MethodPost, "/v1/works",
		map[string]any{"title": "No episode count", "category": "anime"})
	require.Equalf(t, http.StatusCreated, status, "%v", work)

	workID, ok := work["id"].(string)
	require.True(t, ok)

	status, refused := alvaro.call(http.MethodPost, "/v1/library", map[string]any{
		"work_id": workID, "status": "in_progress", "progress": 3000000000,
	})
	require.Equalf(t, http.StatusUnprocessableEntity, status, "%v", refused)
	assert.Equal(t, "invalid_progress", refused["code"])
}

// TestNoClientTextReachesAColumnAsA500 is the regression for the second
// failure of this shape, and the one the in-memory double is least able to
// catch: a Go string holds U+0000 perfectly happily, so only a real column
// refuses it — text with 22021, jsonb with 22P05 for the escape sequence.
//
// Eight requests, because eight is how many places client text reaches a
// text or jsonb column across these routes, and the last of them is a read:
// nothing is written and the 500 happens anyway.
func TestNoClientTextReachesAColumnAsA500(t *testing.T) {
	pool := libraryDB(t, nil)
	base := journeyAPI(t, pool)

	seedMember(t, pool, "alvaro")
	alvaro := &journeyClient{t: t, base: base, token: "valid-alvaro"}

	const nul = "a\x00b"

	status, work := alvaro.call(http.MethodPost, "/v1/works",
		map[string]any{"title": "Host", "category": "anime"})
	require.Equalf(t, http.StatusCreated, status, "%v", work)

	workID, ok := work["id"].(string)
	require.True(t, ok)

	status, entry := alvaro.call(http.MethodPost, "/v1/library",
		map[string]any{"work_id": workID, "status": "wishlist"})
	require.Equalf(t, http.StatusCreated, status, "%v", entry)

	entryID, ok := entry["id"].(string)
	require.True(t, ok)

	probes := []struct {
		name   string
		method string
		path   string
		body   any
		code   string
	}{
		{"a title", http.MethodPost, "/v1/works",
			map[string]any{"title": nul, "category": "anime"}, "invalid_payload"},
		{"a synopsis", http.MethodPost, "/v1/works",
			map[string]any{"title": "S", "category": "anime", "synopsis": nul}, "invalid_payload"},
		{"a cover url", http.MethodPost, "/v1/works",
			map[string]any{"title": "C", "category": "anime", "cover_url": "http://" + nul}, "invalid_payload"},
		{"a metadata value", http.MethodPost, "/v1/works",
			map[string]any{"title": "M", "category": "anime", "metadata": map[string]any{"k": nul}},
			"invalid_payload"},
		{"a metadata key", http.MethodPost, "/v1/works",
			map[string]any{"title": "K", "category": "anime", "metadata": map[string]any{nul: 1}},
			"invalid_payload"},
		{"a note at creation", http.MethodPost, "/v1/library",
			map[string]any{"work_id": workID, "status": "wishlist", "note": nul}, "invalid_payload"},
		{"a note in an update", http.MethodPatch, "/v1/library/" + entryID,
			map[string]any{"note": nul}, "invalid_payload"},
		// The read path. Nothing is written and the 500 happened anyway.
		{"a search query", http.MethodGet, "/v1/works?q=a%00b", nil, "invalid_filter"},
	}

	for _, probe := range probes {
		status, problem := alvaro.call(probe.method, probe.path, probe.body)

		assert.NotEqualf(t, http.StatusInternalServerError, status,
			"a null character in %s answered 500: %v", probe.name, problem)
		assert.Equalf(t, http.StatusBadRequest, status, "%s: %v", probe.name, problem)
		assert.Equalf(t, probe.code, problem["code"], "%s", probe.name)
	}
}
