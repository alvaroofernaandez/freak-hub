package httpx_test

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
)

var hexID = regexp.MustCompile(`^[0-9a-f]{32}$`)

func TestRequestIDMiddlewareGeneratesAnOpaqueIDWhenNoneIsSent(t *testing.T) {
	t.Parallel()

	var seenInContext string
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenInContext = httpx.RequestIDFrom(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)

	httpx.RequestIDMiddleware(next).ServeHTTP(recorder, request)

	headerID := recorder.Header().Get("X-Request-ID")
	require.NotEmpty(t, headerID)
	assert.True(t, hexID.MatchString(headerID), "expected a 128-bit hex id, got %q", headerID)
	assert.Equal(t, headerID, seenInContext, "the header and the context must carry the same id")
}

func TestRequestIDMiddlewareNeverContainsTheHostname(t *testing.T) {
	t.Parallel()

	hostname, err := osHostname()
	require.NoError(t, err)
	if hostname == "" {
		t.Skip("no hostname available in this environment")
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)

	httpx.RequestIDMiddleware(next).ServeHTTP(recorder, request)

	assert.False(t, strings.Contains(recorder.Header().Get("X-Request-ID"), hostname))
}

func TestRequestIDMiddlewareReusesAValidInboundID(t *testing.T) {
	t.Parallel()

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request.Header.Set("X-Request-ID", "client-supplied-id-123")

	httpx.RequestIDMiddleware(next).ServeHTTP(recorder, request)

	assert.Equal(t, "client-supplied-id-123", recorder.Header().Get("X-Request-ID"))
}

func TestRequestIDMiddlewareReplacesAnInvalidInboundID(t *testing.T) {
	t.Parallel()

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request.Header.Set("X-Request-ID", "short")

	httpx.RequestIDMiddleware(next).ServeHTTP(recorder, request)

	assert.NotEqual(t, "short", recorder.Header().Get("X-Request-ID"))
	assert.True(t, hexID.MatchString(recorder.Header().Get("X-Request-ID")))
}

func TestRequestIDFromReturnsEmptyOutsideTheMiddleware(t *testing.T) {
	t.Parallel()

	assert.Empty(t, httpx.RequestIDFrom(httptest.NewRequest(http.MethodGet, "/", nil).Context()))
}
