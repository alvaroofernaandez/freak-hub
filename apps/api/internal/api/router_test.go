package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"net/url"
	"testing"
	"time"

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
	router         http.Handler
	usersRepo      *usersmem.Repository
	inviteRepo     *invitationsmem.Repository
	sender         *invitationsmem.Sender
	memberEmail    *invitationsmem.Members
	profileUpdater *usersmem.ProfileUpdater
	avatarUploader *usersmem.AvatarUploader
}

func newSuite(t *testing.T) *suite {
	t.Helper()

	usersRepo := usersmem.New()
	inviteRepo := invitationsmem.NewRepository()
	sender := invitationsmem.NewSender()
	members := invitationsmem.NewMembers()
	profileUpdater := usersmem.NewProfileUpdater()
	avatarUploader := usersmem.NewAvatarUploader()

	usersService := users.NewService(usersRepo,
		users.WithProfileUpdater(profileUpdater),
		users.WithAvatarUploader(avatarUploader),
	)
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
		usersRepo:      usersRepo,
		inviteRepo:     inviteRepo,
		sender:         sender,
		memberEmail:    members,
		profileUpdater: profileUpdater,
		avatarUploader: avatarUploader,
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

	// Mirrors what the Postgres adapter resolves via its JOIN against the
	// members table: every member is a potential inviter.
	s.inviteRepo.RegisterMember(invitations.InviterSummary{
		ID:          user.ID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
	})

	return user
}

// createInvitationAt pins the invitation's CreatedAt, so group-listing order
// is deterministic instead of depending on wall-clock timing.
func (s *suite) createInvitationAt(t *testing.T, token, email string, at time.Time) *httptest.ResponseRecorder {
	t.Helper()

	s.inviteRepo.NowFunc = func() time.Time { return at }

	return s.do(t, http.MethodPost, "/v1/invitations", token, map[string]string{"email": email})
}

// seedMemberAt pins the member's CreatedAt so member-listing order is
// deterministic instead of depending on wall-clock timing.
func (s *suite) seedMemberAt(t *testing.T, clerkID, username string, at time.Time) users.User {
	t.Helper()

	s.usersRepo.NowFunc = func() time.Time { return at }

	return s.seedMember(t, clerkID, username)
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

// doMultipart posts a single-file multipart/form-data request under
// fieldName, with content and contentType chosen by the caller — which lets
// a test simulate both a valid upload and one with a deliberately wrong
// declared content type (sniffing must not trust it).
func (s *suite) doMultipart(t *testing.T, path, token, fieldName, filename string, content []byte, contentType string) *httptest.ResponseRecorder {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition",
		fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, filename))
	header.Set("Content-Type", contentType)

	part, err := writer.CreatePart(header)
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	request := httptest.NewRequest(http.MethodPost, path, &body)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())

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

type groupInvitationPageBody struct {
	Items      []map[string]any `json:"items"`
	NextCursor *string          `json:"next_cursor"`
}

func TestListGroupInvitationsRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/invitations/group", "", nil)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestListGroupInvitationsReturnsEveryMembersInvitationsWithTheInviter(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_1", "alvaro")
	s.seedMember(t, "user_2", "bea")

	require.Equal(t, http.StatusCreated,
		s.do(t, http.MethodPost, "/v1/invitations", "valid-user_1", map[string]string{"email": "a@correo.com"}).Code)
	require.Equal(t, http.StatusCreated,
		s.do(t, http.MethodPost, "/v1/invitations", "valid-user_2", map[string]string{"email": "b@correo.com"}).Code)

	// Any member can see the whole trail, not just their own invitations.
	recorder := s.do(t, http.MethodGet, "/v1/invitations/group", "valid-user_1", nil)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := decode[groupInvitationPageBody](t, recorder)
	require.Len(t, body.Items, 2)

	byEmail := map[string]map[string]any{}
	for _, item := range body.Items {
		byEmail[item["email"].(string)] = item
	}

	require.Contains(t, byEmail, "a@correo.com")
	require.Contains(t, byEmail, "b@correo.com")

	inviterA, ok := byEmail["a@correo.com"]["inviter"].(map[string]any)
	require.True(t, ok, "each entry must carry the inviter's identity, not just an id")
	assert.Equal(t, "alvaro", inviterA["username"])

	inviterB, ok := byEmail["b@correo.com"]["inviter"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "bea", inviterB["username"])
}

func TestListGroupInvitationsIncludesEveryStatus(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_1", "alvaro")
	require.Equal(t, http.StatusCreated,
		s.do(t, http.MethodPost, "/v1/invitations", "valid-user_1", map[string]string{"email": "a@correo.com"}).Code)

	recorder := s.do(t, http.MethodGet, "/v1/invitations/group", "valid-user_1", nil)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := decode[groupInvitationPageBody](t, recorder)
	require.Len(t, body.Items, 1)
	assert.Equal(t, "pending", body.Items[0]["status"])
}

func TestListGroupInvitationsPaginatesNewestFirst(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_1", "alvaro")
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	require.Equal(t, http.StatusCreated, s.createInvitationAt(t, "valid-user_1", "a@correo.com", base).Code)
	require.Equal(t, http.StatusCreated, s.createInvitationAt(t, "valid-user_1", "b@correo.com", base.Add(time.Hour)).Code)
	require.Equal(t, http.StatusCreated, s.createInvitationAt(t, "valid-user_1", "c@correo.com", base.Add(2*time.Hour)).Code)

	first := s.do(t, http.MethodGet, "/v1/invitations/group?limit=2", "valid-user_1", nil)
	require.Equal(t, http.StatusOK, first.Code)
	firstBody := decode[groupInvitationPageBody](t, first)
	require.Len(t, firstBody.Items, 2)
	require.NotNil(t, firstBody.NextCursor)
	assert.Equal(t, "c@correo.com", firstBody.Items[0]["email"])
	assert.Equal(t, "b@correo.com", firstBody.Items[1]["email"])

	second := s.do(t, http.MethodGet,
		"/v1/invitations/group?limit=2&cursor="+url.QueryEscape(*firstBody.NextCursor), "valid-user_1", nil)
	require.Equal(t, http.StatusOK, second.Code)
	secondBody := decode[groupInvitationPageBody](t, second)
	require.Len(t, secondBody.Items, 1)
	assert.Equal(t, "a@correo.com", secondBody.Items[0]["email"])
	assert.Nil(t, secondBody.NextCursor)
}

func TestListGroupInvitationsRejectsAnInvalidLimit(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_1", "alvaro")

	recorder := s.do(t, http.MethodGet, "/v1/invitations/group?limit=0", "valid-user_1", nil)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_limit", decode[map[string]string](t, recorder)["code"])
}

func TestListGroupInvitationsRejectsAnInvalidCursor(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_1", "alvaro")

	recorder := s.do(t, http.MethodGet, "/v1/invitations/group?cursor=not-a-valid-cursor", "valid-user_1", nil)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_cursor", decode[map[string]string](t, recorder)["code"])
}

type memberPageBody struct {
	Items      []map[string]any `json:"items"`
	NextCursor *string          `json:"next_cursor"`
}

func TestListMembersRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodGet, "/v1/members", "", nil)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestListMembersReturnsTheGroupOrderedByMemberSince(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s.seedMemberAt(t, "user_1", "alvaro", base)
	s.seedMemberAt(t, "user_2", "bea", base.Add(time.Hour))

	recorder := s.do(t, http.MethodGet, "/v1/members", "valid-user_1", nil)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := decode[memberPageBody](t, recorder)
	require.Len(t, body.Items, 2)
	assert.Equal(t, "alvaro", body.Items[0]["username"])
	assert.Equal(t, "bea", body.Items[1]["username"])
	assert.NotEmpty(t, body.Items[0]["created_at"])
	assert.Nil(t, body.NextCursor)
}

func TestListMembersPaginatesWithLimitAndCursor(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s.seedMemberAt(t, "user_1", "alvaro", base)
	s.seedMemberAt(t, "user_2", "bea", base.Add(time.Hour))
	s.seedMemberAt(t, "user_3", "carol", base.Add(2*time.Hour))

	first := s.do(t, http.MethodGet, "/v1/members?limit=2", "valid-user_1", nil)
	require.Equal(t, http.StatusOK, first.Code)
	firstBody := decode[memberPageBody](t, first)
	require.Len(t, firstBody.Items, 2)
	require.NotNil(t, firstBody.NextCursor)

	second := s.do(t, http.MethodGet,
		"/v1/members?limit=2&cursor="+url.QueryEscape(*firstBody.NextCursor), "valid-user_1", nil)
	require.Equal(t, http.StatusOK, second.Code)
	secondBody := decode[memberPageBody](t, second)
	require.Len(t, secondBody.Items, 1)
	assert.Equal(t, "carol", secondBody.Items[0]["username"])
	assert.Nil(t, secondBody.NextCursor)
}

func TestListMembersRejectsAnInvalidLimit(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_1", "alvaro")

	recorder := s.do(t, http.MethodGet, "/v1/members?limit=0", "valid-user_1", nil)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_limit", decode[map[string]string](t, recorder)["code"])
}

func TestListMembersRejectsAnInvalidCursor(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_1", "alvaro")

	recorder := s.do(t, http.MethodGet, "/v1/members?cursor=not-a-valid-cursor", "valid-user_1", nil)

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_cursor", decode[map[string]string](t, recorder)["code"])
}

func TestPatchMeRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodPatch, "/v1/me", "", map[string]string{"username": "nuevo"})

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestPatchMeIs404WhenTheSessionHasNoLocalMemberYet(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).do(t, http.MethodPatch, "/v1/me", "valid-user_unknown",
		map[string]string{"username": "nuevo"})

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "unknown_identity", decode[map[string]string](t, recorder)["code"])
}

func TestPatchMeRejectsAnUnknownField(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.do(t, http.MethodPatch, "/v1/me", "valid-user_123",
		map[string]string{"clerk_user_id": "user_999", "username": "nuevo"})

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "invalid_payload", decode[map[string]string](t, recorder)["code"])
}

func TestPatchMeRejectsAUsernameThatIsTooShort(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.do(t, http.MethodPatch, "/v1/me", "valid-user_123", map[string]string{"username": "ab"})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code)
	assert.Equal(t, "username_invalid_length", decode[map[string]string](t, recorder)["code"])
}

func TestPatchMeRejectsANumericOnlyUsername(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.do(t, http.MethodPatch, "/v1/me", "valid-user_123", map[string]string{"username": "12345"})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code)
	assert.Equal(t, "username_numeric_only", decode[map[string]string](t, recorder)["code"])
}

func TestPatchMeReturns409WhenTheUsernameIsTaken(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")
	s.profileUpdater.Err = users.ErrUsernameTaken

	recorder := s.do(t, http.MethodPatch, "/v1/me", "valid-user_123", map[string]string{"username": "tomado"})

	assert.Equal(t, http.StatusConflict, recorder.Code)
	assert.Equal(t, "username_taken", decode[map[string]string](t, recorder)["code"])
}

func TestPatchMeUpdatesTheDisplayNameAndUsername(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")
	s.profileUpdater.Profile = users.ClerkProfile{
		ClerkUserID: "user_123",
		Username:    "nuevo",
		DisplayName: "Nuevo Nombre",
	}

	recorder := s.do(t, http.MethodPatch, "/v1/me", "valid-user_123", map[string]string{
		"first_name": "Nuevo",
		"last_name":  "Nombre",
		"username":   "nuevo",
	})

	require.Equal(t, http.StatusOK, recorder.Code)
	body := decode[map[string]any](t, recorder)
	assert.Equal(t, "nuevo", body["username"])
	assert.Equal(t, "Nuevo Nombre", body["display_name"])
	require.NotNil(t, s.profileUpdater.LastUpdate)
	require.NotNil(t, s.profileUpdater.LastUpdate.Username)
	assert.Equal(t, "nuevo", *s.profileUpdater.LastUpdate.Username)
}

// pngBytes builds a minimal, syntactically fake PNG: it starts with the real
// 8-byte PNG signature http.DetectContentType keys off, padded with zeros up
// to size, so tests can control content type detection and byte size
// independently without a real image codec.
func pngBytes(size int) []byte {
	signature := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}
	data := make([]byte, size)
	copy(data, signature)

	return data
}

func TestUploadAvatarRequiresASession(t *testing.T) {
	t.Parallel()

	recorder := newSuite(t).doMultipart(t, "/v1/me/avatar", "", "file", "avatar.png", pngBytes(100), "image/png")

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestUploadAvatarRejectsAnUnsupportedContentType(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.doMultipart(t, "/v1/me/avatar", "valid-user_123", "file", "avatar.txt",
		[]byte("this is plain text, not an image"), "text/plain")

	assert.Equal(t, http.StatusUnsupportedMediaType, recorder.Code)
	assert.Equal(t, "avatar_unsupported_type", decode[map[string]string](t, recorder)["code"])
	assert.False(t, s.avatarUploader.Called)
}

func TestUploadAvatarRejectsAnOversizedFile(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.doMultipart(t, "/v1/me/avatar", "valid-user_123", "file", "avatar.png",
		pngBytes(users.MaxAvatarBytes+1), "image/png")

	assert.Equal(t, http.StatusRequestEntityTooLarge, recorder.Code)
	assert.False(t, s.avatarUploader.Called)
}

func TestUploadAvatarUpdatesTheAvatarURL(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")
	s.avatarUploader.Profile = users.ClerkProfile{AvatarURL: "https://img.clerk.com/nuevo.png"}

	recorder := s.doMultipart(t, "/v1/me/avatar", "valid-user_123", "file", "avatar.png", pngBytes(1024), "image/png")

	require.Equal(t, http.StatusOK, recorder.Code)
	body := decode[map[string]any](t, recorder)
	assert.Equal(t, "https://img.clerk.com/nuevo.png", body["avatar_url"])
	assert.True(t, s.avatarUploader.Called)
}

// TestUploadAvatarIgnoresADeclaredContentTypeThatDoesNotMatchTheBytes proves
// sniffContentType really reads the file's own bytes instead of trusting the
// Content-Type the client declared in the multipart part: a client claiming
// "image/png" while sending plain text must still be rejected, because the
// sniffed type is what decides, not the declared header.
func TestUploadAvatarIgnoresADeclaredContentTypeThatDoesNotMatchTheBytes(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")

	recorder := s.doMultipart(t, "/v1/me/avatar", "valid-user_123", "file", "avatar.png",
		[]byte("this is plain text, not an image"), "image/png")

	assert.Equal(t, http.StatusUnsupportedMediaType, recorder.Code)
	assert.Equal(t, "avatar_unsupported_type", decode[map[string]string](t, recorder)["code"])
	assert.False(t, s.avatarUploader.Called)
}

// TestUploadAvatarAcceptsBytesOfAnAllowedTypeRegardlessOfTheDeclaredContentType
// is the mirror case: a client that (wrongly, or maliciously) declares
// "text/plain" while actually sending PNG bytes must still succeed, because
// the sniffed type — not the declared one — is an allowed image type.
func TestUploadAvatarAcceptsBytesOfAnAllowedTypeRegardlessOfTheDeclaredContentType(t *testing.T) {
	t.Parallel()

	s := newSuite(t)
	s.seedMember(t, "user_123", "alvaro")
	s.avatarUploader.Profile = users.ClerkProfile{AvatarURL: "https://img.clerk.com/nuevo.png"}

	recorder := s.doMultipart(t, "/v1/me/avatar", "valid-user_123", "file", "avatar.png",
		pngBytes(1024), "text/plain")

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.True(t, s.avatarUploader.Called)
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
