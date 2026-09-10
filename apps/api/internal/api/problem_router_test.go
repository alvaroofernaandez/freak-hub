package api_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/api"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations/invitationsmem"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/upstream"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users/usersmem"
)

// decodeProblem decodes a full Problem body, for tests that check more than
// just `code`.
func decodeProblem(t *testing.T, recorder *httptest.ResponseRecorder) httpx.Problem {
	t.Helper()

	var problem httpx.Problem
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &problem), "body: %s", recorder.Body.String())

	return problem
}

func TestMethodNotAllowedIsAProblem405(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodDelete, "/healthz", "", nil)

	assert.Equal(t, http.StatusMethodNotAllowed, recorder.Code)
	assert.Equal(t, "application/problem+json", recorder.Header().Get("Content-Type"))
	assert.Equal(t, "method_not_allowed", errorCode(t, recorder))
}

func TestEverySuccessfulResponseCarriesAnXRequestIDHeader(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/healthz", "", nil)

	assert.NotEmpty(t, recorder.Header().Get("X-Request-ID"))
}

func TestErrorResponseCorrelationIDMatchesTheXRequestIDHeader(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/nope", "valid-user_123", nil)

	headerID := recorder.Header().Get("X-Request-ID")
	require.NotEmpty(t, headerID)
	assert.Equal(t, headerID, decodeProblem(t, recorder).CorrelationID)
}

func TestInboundRequestIDIsReusedWhenValid(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	request.Header.Set("X-Request-ID", "client-supplied-id-123")
	recorder := httptest.NewRecorder()

	s.router.ServeHTTP(recorder, request)

	assert.Equal(t, "client-supplied-id-123", recorder.Header().Get("X-Request-ID"))
}

func TestInboundRequestIDIsReplacedWhenInvalid(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	request.Header.Set("X-Request-ID", "short")
	recorder := httptest.NewRecorder()

	s.router.ServeHTTP(recorder, request)

	assert.NotEqual(t, "short", recorder.Header().Get("X-Request-ID"))
	assert.NotEmpty(t, recorder.Header().Get("X-Request-ID"))
}

// panickingUsersRepo panics on ByClerkID, so the router's Recoverer
// middleware can be exercised end to end (through a real domain call, not a
// synthetic handler).
type panickingUsersRepo struct{ *usersmem.Repository }

func (panickingUsersRepo) ByClerkID(context.Context, string) (users.User, error) {
	panic("boom: the repository exploded")
}

func TestAPanicIsRecoveredAsAProblem500WithoutLeakingThePanicValue(t *testing.T) {
	t.Parallel()

	usersService := users.NewService(panickingUsersRepo{usersmem.New()})
	invitationsService := invitations.NewService(invitations.ServiceDeps{
		Sender:     invitationsmem.NewSender(),
		Repository: invitationsmem.NewRepository(),
		Members:    invitationsmem.NewMembers(),
	})
	router := api.NewRouter(api.Deps{
		Users:          usersService,
		Invitations:    invitationsService,
		Verifier:       tokenVerifier{},
		AllowedOrigins: []string{"http://localhost:3000"},
	})

	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request.Header.Set("Authorization", "Bearer valid-user_123")
	recorder := httptest.NewRecorder()

	require.NotPanics(t, func() {
		router.ServeHTTP(recorder, request)
	})

	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.NotContains(t, recorder.Body.String(), "boom: the repository exploded")
	assert.Equal(t, "internal_error", errorCode(t, recorder))
}

func TestProfileUpdateDeadlineExceededIsARequestTimeout(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")
	s.profileUpdater.Err = fmt.Errorf("clerk update: %w", context.DeadlineExceeded)

	recorder := s.do(t, http.MethodPatch, "/v1/me", "valid-user_123", map[string]string{"username": "nuevo123"})

	assert.Equal(t, http.StatusGatewayTimeout, recorder.Code)
	problem := decodeProblem(t, recorder)
	assert.Equal(t, httpx.CodeRequestTimeout, problem.Code)
	assert.True(t, problem.Retryable)
}

func TestProfileUpdateUpstreamUnavailableIs503AndRetryable(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")
	s.profileUpdater.Err = fmt.Errorf("clerk api unavailable: %w", upstream.ErrUnavailable)

	recorder := s.do(t, http.MethodPatch, "/v1/me", "valid-user_123", map[string]string{"username": "nuevo123"})

	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	problem := decodeProblem(t, recorder)
	assert.Equal(t, httpx.CodeUpstreamUnavailable, problem.Code)
	assert.True(t, problem.Retryable)
}

func TestProfileUpdateUnknownErrorIsAGenericInternalErrorWithoutTheRawText(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")
	s.profileUpdater.Err = fmt.Errorf("pq: connection reset by peer on host 10.0.0.7")

	recorder := s.do(t, http.MethodPatch, "/v1/me", "valid-user_123", map[string]string{"username": "nuevo123"})

	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.Equal(t, "internal_error", errorCode(t, recorder))
	assert.NotContains(t, recorder.Body.String(), "10.0.0.7")
	assert.NotContains(t, recorder.Body.String(), "pq:")
}

func TestClientCancellationWritesNothingMeaningful(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")
	s.profileUpdater.Err = fmt.Errorf("clerk update: %w", context.Canceled)

	recorder := s.do(t, http.MethodPatch, "/v1/me", "valid-user_123", map[string]string{"username": "nuevo123"})

	assert.Empty(t, recorder.Body.String())
}

func TestCreateInvitationFieldErrorIsScopedToEmail(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.do(t, http.MethodPost, "/v1/invitations", "valid-user_123",
		map[string]string{"email": "no-arroba"})

	problem := decodeProblem(t, recorder)
	require.Len(t, problem.FieldErrors, 1)
	assert.Equal(t, "email", problem.FieldErrors[0].Field)
}

func TestUploadAvatarFieldErrorIsScopedToAvatar(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.doMultipart(t, "/v1/me/avatar", "valid-user_123", "file", "avatar.txt",
		[]byte("this is plain text, not an image"), "text/plain")

	problem := decodeProblem(t, recorder)
	require.Len(t, problem.FieldErrors, 1)
	assert.Equal(t, "avatar", problem.FieldErrors[0].Field)
}

func TestPatchMeUsernameTooShortFieldErrorIsScopedToUsername(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.do(t, http.MethodPatch, "/v1/me", "valid-user_123", map[string]string{"username": "ab"})

	problem := decodeProblem(t, recorder)
	require.Len(t, problem.FieldErrors, 1)
	assert.Equal(t, "username", problem.FieldErrors[0].Field)
}
