package auth_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/auth"
)

type stubVerifier struct {
	identity   auth.Identity
	err        error
	seenTokens []string
}

func (s *stubVerifier) Verify(_ context.Context, token string) (auth.Identity, error) {
	s.seenTokens = append(s.seenTokens, token)
	return s.identity, s.err
}

// protected wires the middleware around a handler that records whether it ran
// and what identity it could see.
func protected(t *testing.T, verifier auth.Verifier) (http.Handler, *bool, *auth.Identity) {
	t.Helper()

	called := false
	seen := auth.Identity{}

	handler := auth.Middleware(verifier)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		identity, ok := auth.IdentityFrom(r.Context())
		require.True(t, ok, "handler must be able to read the identity")
		seen = identity
		w.WriteHeader(http.StatusOK)
	}))

	return handler, &called, &seen
}

func errorCode(t *testing.T, recorder *httptest.ResponseRecorder) string {
	t.Helper()

	var body struct {
		Code string `json:"code"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))

	return body.Code
}

func TestMiddlewareRejectsRequestWithoutAuthorizationHeader(t *testing.T) {
	t.Parallel()

	handler, called, _ := protected(t, &stubVerifier{})
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/v1/me", nil))

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
	assert.False(t, *called, "the protected handler must not run")
}

func TestMiddlewareRejectsNonBearerScheme(t *testing.T) {
	t.Parallel()

	handler, called, _ := protected(t, &stubVerifier{})
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
	assert.False(t, *called)
}

func TestMiddlewareRejectsEmptyBearerToken(t *testing.T) {
	t.Parallel()

	handler, called, _ := protected(t, &stubVerifier{})
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request.Header.Set("Authorization", "Bearer    ")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "missing_token", errorCode(t, recorder))
	assert.False(t, *called)
}

func TestMiddlewareRejectsTokenTheVerifierRefuses(t *testing.T) {
	t.Parallel()

	verifier := &stubVerifier{err: errors.New("expired")}
	handler, called, _ := protected(t, verifier)
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request.Header.Set("Authorization", "Bearer expired-token")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, "invalid_token", errorCode(t, recorder))
	assert.False(t, *called)
	assert.Equal(t, []string{"expired-token"}, verifier.seenTokens)
}

func TestMiddlewareNeverLeaksTheVerifierErrorToTheClient(t *testing.T) {
	t.Parallel()

	handler, _, _ := protected(t, &stubVerifier{err: errors.New("jwks fetch failed for kid=abc123")})
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request.Header.Set("Authorization", "Bearer whatever")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	assert.NotContains(t, recorder.Body.String(), "jwks")
	assert.NotContains(t, recorder.Body.String(), "kid=abc123")
}

func TestMiddlewarePassesTheIdentityToTheHandler(t *testing.T) {
	t.Parallel()

	identity := auth.Identity{ClerkUserID: "user_123", SessionID: "sess_456"}
	handler, called, seen := protected(t, &stubVerifier{identity: identity})
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request.Header.Set("Authorization", "Bearer good-token")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.True(t, *called)
	assert.Equal(t, identity, *seen)
}

func TestMiddlewareAcceptsLowercaseBearerScheme(t *testing.T) {
	t.Parallel()

	handler, called, _ := protected(t, &stubVerifier{identity: auth.Identity{ClerkUserID: "user_123"}})
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request.Header.Set("Authorization", "bearer good-token")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.True(t, *called)
}

func TestIdentityFromReportsMissingIdentity(t *testing.T) {
	t.Parallel()

	_, ok := auth.IdentityFrom(context.Background())

	assert.False(t, ok)
}
