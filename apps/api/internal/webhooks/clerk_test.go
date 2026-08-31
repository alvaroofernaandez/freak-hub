package webhooks_test

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations/invitationsmem"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users/usersmem"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/webhooks"
)

type stubSignature struct{ err error }

func (s stubSignature) Verify(_ []byte, _ http.Header) error { return s.err }

type harness struct {
	handler    *webhooks.ClerkHandler
	usersRepo  *usersmem.Repository
	inviteRepo *invitationsmem.Repository
}

func newHarness(t *testing.T, signatureErr error) *harness {
	t.Helper()

	usersRepo := usersmem.New()
	inviteRepo := invitationsmem.NewRepository()

	return &harness{
		handler: webhooks.NewClerkHandler(webhooks.ClerkDeps{
			Signature: stubSignature{err: signatureErr},
			Users:     users.NewService(usersRepo),
			Invitations: invitations.NewService(invitations.ServiceDeps{
				Sender:     invitationsmem.NewSender(),
				Repository: inviteRepo,
				Members:    invitationsmem.NewMembers(),
			}),
		}),
		usersRepo:  usersRepo,
		inviteRepo: inviteRepo,
	}
}

func (h *harness) post(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()

	request := httptest.NewRequest(http.MethodPost, "/webhooks/clerk", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	h.handler.ServeHTTP(recorder, request)

	return recorder
}

const userCreated = `{
  "type": "user.created",
  "data": {
    "id": "user_123",
    "username": "alvaro",
    "first_name": "Álvaro",
    "last_name": "Fernández",
    "image_url": "https://img.clerk.com/a.png",
    "primary_email_address_id": "idn_1",
    "email_addresses": [{"id": "idn_1", "email_address": "alvaro@correo.com"}]
  }
}`

func TestWebhookRejectsAnInvalidSignature(t *testing.T) {
	t.Parallel()

	h := newHarness(t, errors.New("bad signature"))

	recorder := h.post(t, userCreated)

	assert.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Equal(t, 0, h.usersRepo.Count(), "an unsigned delivery must never reach the domain")
}

func TestWebhookRejectsAMalformedBody(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)

	recorder := h.post(t, "{not json")

	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, 0, h.usersRepo.Count())
}

func TestWebhookCreatesTheMemberOnUserCreated(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)

	recorder := h.post(t, userCreated)

	require.Equal(t, http.StatusNoContent, recorder.Code)
	user, err := h.usersRepo.ByClerkID(context.Background(), "user_123")
	require.NoError(t, err)
	assert.Equal(t, "alvaro", user.Username)
	assert.Equal(t, "Álvaro Fernández", user.DisplayName)
	assert.Equal(t, "https://img.clerk.com/a.png", user.AvatarURL)
}

func TestWebhookIsIdempotentAcrossRedeliveries(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)

	require.Equal(t, http.StatusNoContent, h.post(t, userCreated).Code)
	require.Equal(t, http.StatusNoContent, h.post(t, userCreated).Code)

	assert.Equal(t, 1, h.usersRepo.Count())
}

func TestWebhookFallsBackToTheUsernameWhenThereIsNoName(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)

	recorder := h.post(t, `{"type":"user.created","data":{"id":"user_9","username":"friki"}}`)

	require.Equal(t, http.StatusNoContent, recorder.Code)
	user, err := h.usersRepo.ByClerkID(context.Background(), "user_9")
	require.NoError(t, err)
	assert.Equal(t, "friki", user.DisplayName)
}

func TestWebhookRejectsAUserEventWithoutUsername(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)

	recorder := h.post(t, `{"type":"user.created","data":{"id":"user_9"}}`)

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code)
	assert.Equal(t, 0, h.usersRepo.Count())
}

func TestWebhookMarksTheInvitationAsAccepted(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)
	ctx := context.Background()
	_, err := h.inviteRepo.Create(ctx, invitations.Invitation{
		Email:  "alvaro@correo.com",
		Status: invitations.StatusPending,
	})
	require.NoError(t, err)

	require.Equal(t, http.StatusNoContent, h.post(t, userCreated).Code)

	_, err = h.inviteRepo.PendingByEmail(ctx, "alvaro@correo.com")
	assert.ErrorIs(t, err, invitations.ErrNotFound, "the invitation should no longer be pending")
}

func TestWebhookDeletesTheMemberOnUserDeleted(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)
	require.Equal(t, http.StatusNoContent, h.post(t, userCreated).Code)

	recorder := h.post(t, `{"type":"user.deleted","data":{"id":"user_123","deleted":true}}`)

	require.Equal(t, http.StatusNoContent, recorder.Code)
	assert.Equal(t, 0, h.usersRepo.Count())
}

func TestWebhookIgnoresAnEventItDoesNotHandle(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)

	recorder := h.post(t, `{"type":"session.created","data":{"id":"sess_1"}}`)

	assert.Equal(t, http.StatusNoContent, recorder.Code)
	assert.Equal(t, 0, h.usersRepo.Count())
}
