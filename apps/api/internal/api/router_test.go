package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/api"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/auth"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations/invitationsmem"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users/usersmem"
)

// tokenVerifier accepts "valid-<clerk id>" and rejects everything else, which
// keeps the router tests free of real JWTs.
type tokenVerifier struct{}

func (tokenVerifier) Verify(_ context.Context, token string) (auth.Identity, error) {
	const prefix = "valid-"
	if len(token) <= len(prefix) || token[:len(prefix)] != prefix {
		return auth.Identity{}, assertInvalidToken
	}

	return auth.Identity{ClerkUserID: token[len(prefix):], SessionID: "sess_test"}, nil
}

var assertInvalidToken = &tokenError{}

type tokenError struct{}

func (*tokenError) Error() string { return "invalid token" }

type suite struct {
	router      http.Handler
	usersRepo   *usersmem.Repository
	inviteRepo  *invitationsmem.Repository
	sender      *invitationsmem.Sender
	memberEmail *invitationsmem.Members
}

func newSuite(t *testing.T) *suite {
	t.Helper()

	usersRepo := usersmem.New()
	inviteRepo := invitationsmem.NewRepository()
	sender := invitationsmem.NewSender()
	members := invitationsmem.NewMembers()

	usersService := users.NewService(usersRepo)
	invitationsService := invitations.NewService(invitations.ServiceDeps{
		Sender:      sender,
		Repository:  inviteRepo,
		Members:     members,
		RedirectURL: "https://freakhub.local/registro",
	})

	return &suite{
		router: api.NewRouter(api.Deps{
			Users:          usersService,
			Invitations:    invitationsService,
			Verifier:       tokenVerifier{},
			AllowedOrigins: []string{"http://localhost:3000"},
		}),
		usersRepo:   usersRepo,
		inviteRepo:  inviteRepo,
		sender:      sender,
		memberEmail: members,
	}
}

func (s *suite) seedMember(t *testing.T, clerkID, username string) users.User {
	t.Helper()

	user, err := users.NewService(s.usersRepo).EnsureFromClerk(context.Background(), users.ClerkProfile{
		ClerkUserID: clerkID,
		Username:    username,
		DisplayName: username,
	})
	require.NoError(t, err)

	return user
}

func (s *suite) do(t *testing.T, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()

	var reader *bytes.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		require.NoError(t, err)
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}

	request := httptest.NewRequest(method, path, reader)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	request.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	s.router.ServeHTTP(recorder, request)

	return recorder
}

func decode[T any](t *testing.T, recorder *httptest.ResponseRecorder) T {
	t.Helper()

	var payload T
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload), "body: %s", recorder.Body.String())

	return payload
}

func TestHealthzIsPublic(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/healthz", "", nil)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "ok", decode[map[string]string](t, recorder)["status"])
}

func TestMeRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/me", "", nil)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestMeReturnsTheAuthenticatedMember(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.do(t, http.MethodGet, "/v1/me", "valid-user_123", nil)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := decode[map[string]any](t, recorder)
	assert.Equal(t, "alvaro", body["username"])
	assert.Equal(t, "user_123", body["clerk_user_id"])
}

func TestMeIs404WhenTheSessionHasNoLocalMemberYet(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/me", "valid-user_unknown", nil)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "unknown_identity", decode[map[string]string](t, recorder)["code"])
}

func TestCreateInvitationRequiresASession(t *testing.T) {
	t.Parallel()

	s := newSuite(t)

	recorder := s.do(t, http.MethodPost, "/v1/invitations", "", map[string]string{"email": "a@correo.com"})

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Empty(t, s.sender.Emails)
}

func TestCreateInvitationSendsIt(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	inviter := s.seedMember(t, "user_123", "alvaro")

	recorder := s.do(t, http.MethodPost, "/v1/invitations", "valid-user_123",
		map[string]string{"email": "amigo@correo.com"})

	require.Equal(t, http.StatusCreated, recorder.Code)
	body := decode[map[string]any](t, recorder)
	assert.Equal(t, "amigo@correo.com", body["email"])
	assert.Equal(t, "pending", body["status"])
	assert.Equal(t, []string{"amigo@correo.com"}, s.sender.Emails)

	stored, err := s.inviteRepo.ListByInviter(context.Background(), inviter.ID)
	require.NoError(t, err)
	require.Len(t, stored, 1)
	assert.Equal(t, inviter.ID, stored[0].InviterID)
}

func TestCreateInvitationRejectsAnInvalidEmail(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.do(t, http.MethodPost, "/v1/invitations", "valid-user_123",
		map[string]string{"email": "no-arroba"})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code)
	assert.Empty(t, s.sender.Emails)
}

func TestCreateInvitationIsAConflictWhenOneIsPending(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")
	payload := map[string]string{"email": "amigo@correo.com"}

	require.Equal(t, http.StatusCreated,
		s.do(t, http.MethodPost, "/v1/invitations", "valid-user_123", payload).Code)

	recorder := s.do(t, http.MethodPost, "/v1/invitations", "valid-user_123", payload)

	assert.Equal(t, http.StatusConflict, recorder.Code)
	assert.Equal(t, "invitation_already_sent", decode[map[string]string](t, recorder)["code"])
}

func TestCreateInvitationRejectsAnUnknownField(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.do(t, http.MethodPost, "/v1/invitations", "valid-user_123",
		map[string]string{"email": "amigo@correo.com", "role": "admin"})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Empty(t, s.sender.Emails)
}

func TestListMyInvitations(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")
	s.do(t, http.MethodPost, "/v1/invitations", "valid-user_123", map[string]string{"email": "a@correo.com"})
	s.do(t, http.MethodPost, "/v1/invitations", "valid-user_123", map[string]string{"email": "b@correo.com"})

	recorder := s.do(t, http.MethodGet, "/v1/invitations", "valid-user_123", nil)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := decode[struct {
		Items []map[string]any `json:"items"`
	}](t, recorder)
	assert.Len(t, body.Items, 2)
}

func TestUnknownRouteIsJSON(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/nope", "valid-user_123", nil)

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "not_found", decode[map[string]string](t, recorder)["code"])
}

func TestCORSAllowsTheConfiguredOrigin(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodOptions, "/v1/me", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	request.Header.Set("Access-Control-Request-Method", "GET")
	recorder := httptest.NewRecorder()

	newSuite(t).router.ServeHTTP(recorder, request)

	assert.Equal(t, "http://localhost:3000", recorder.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSRejectsAnUnknownOrigin(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodOptions, "/v1/me", nil)
	request.Header.Set("Origin", "https://evil.example")
	request.Header.Set("Access-Control-Request-Method", "GET")
	recorder := httptest.NewRecorder()

	newSuite(t).router.ServeHTTP(recorder, request)

	assert.Empty(t, recorder.Header().Get("Access-Control-Allow-Origin"))
}

var _ = uuid.Nil
