package webhooks_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations/invitationsmem"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users/usersmem"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/webhooks"
)

func decodeCode(t *testing.T, recorder *httptest.ResponseRecorder) string {
	t.Helper()

	var body struct {
		Code string `json:"code"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))

	return body.Code
}

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

func TestWebhookRejectsABodyOverTheLimitAs413(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)

	huge := strings.Repeat("a", (1<<20)+1)
	recorder := h.post(t, `{"type":"user.created","data":{"id":"`+huge+`"}}`)

	assert.Equal(t, http.StatusRequestEntityTooLarge, recorder.Code)
	assert.Equal(t, "payload_too_large", decodeCode(t, recorder))
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

func TestWebhookRecordsWhoInvitedTheNewMember(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)
	ctx := context.Background()
	inviter := uuid.New()
	_, err := h.inviteRepo.Create(ctx, invitations.Invitation{
		Email:     "alvaro@correo.com",
		InviterID: inviter,
		Status:    invitations.StatusPending,
	})
	require.NoError(t, err)

	require.Equal(t, http.StatusNoContent, h.post(t, userCreated).Code)

	member, err := h.usersRepo.ByClerkID(ctx, "user_123")
	require.NoError(t, err)
	require.NotNil(t, member.InvitedBy, "the pending invitation knew who brought this member in")
	assert.Equal(t, inviter, *member.InvitedBy)
}

func TestWebhookLeavesInvitedByNilWithoutAPendingInvitation(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)

	require.Equal(t, http.StatusNoContent, h.post(t, userCreated).Code)

	member, err := h.usersRepo.ByClerkID(context.Background(), "user_123")
	require.NoError(t, err)
	assert.Nil(t, member.InvitedBy, "a founder or a hand-made Clerk account has nobody to point at")
}

func TestWebhookRedeliveryDoesNotOverwriteInvitedBy(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)
	ctx := context.Background()
	inviter := uuid.New()
	_, err := h.inviteRepo.Create(ctx, invitations.Invitation{
		Email:     "alvaro@correo.com",
		InviterID: inviter,
		Status:    invitations.StatusPending,
	})
	require.NoError(t, err)

	// The second delivery finds nothing left to close, so it carries no
	// inviter. It must not erase the one the first delivery recorded.
	require.Equal(t, http.StatusNoContent, h.post(t, userCreated).Code)
	require.Equal(t, http.StatusNoContent, h.post(t, userCreated).Code)

	member, err := h.usersRepo.ByClerkID(ctx, "user_123")
	require.NoError(t, err)
	require.NotNil(t, member.InvitedBy)
	assert.Equal(t, inviter, *member.InvitedBy)
	assert.Equal(t, 1, h.usersRepo.Count())
}

func TestWebhookStillCreatesTheMemberWhenTheInvitationCannotBeClosed(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)
	ctx := context.Background()
	inviter := uuid.New()
	_, err := h.inviteRepo.Create(ctx, invitations.Invitation{
		Email:     "alvaro@correo.com",
		InviterID: inviter,
		Status:    invitations.StatusPending,
	})
	require.NoError(t, err)

	h.inviteRepo.MarkAcceptedErr = errors.New("the database is down")

	// Closing the invitation is bookkeeping. Clerk must not be told to retry an
	// event whose main effect succeeded, and the inviter was read before the
	// upsert, so the member keeps it.
	require.Equal(t, http.StatusNoContent, h.post(t, userCreated).Code)

	member, err := h.usersRepo.ByClerkID(ctx, "user_123")
	require.NoError(t, err)
	require.NotNil(t, member.InvitedBy)
	assert.Equal(t, inviter, *member.InvitedBy)
}

// userCreatedWithoutUsername is the same account as userCreated, minus the
// username: EnsureFromClerk cannot project it, so the handler answers 422 and
// Clerk stops retrying.
const userCreatedWithoutUsername = `{
  "type": "user.created",
  "data": {
    "id": "user_123",
    "primary_email_address_id": "idn_1",
    "email_addresses": [{"id": "idn_1", "email_address": "alvaro@correo.com"}]
  }
}`

func TestWebhookKeepsTheInvitationPendingWhenTheMemberCannotBeCreated(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)
	ctx := context.Background()
	inviter := uuid.New()
	_, err := h.inviteRepo.Create(ctx, invitations.Invitation{
		Email:     "alvaro@correo.com",
		InviterID: inviter,
		Status:    invitations.StatusPending,
	})
	require.NoError(t, err)

	h.usersRepo.UpsertErr = errors.New("the database is down")
	require.Equal(t, http.StatusInternalServerError, h.post(t, userCreated).Code)

	pending, err := h.inviteRepo.PendingByEmail(ctx, "alvaro@correo.com")
	require.NoError(t, err, "Clerk retries a 500: the invitation must still be there to close")
	assert.Equal(t, inviter, pending.InviterID)

	// The retry is the delivery that finally creates the member, and it still
	// knows who invited them.
	h.usersRepo.UpsertErr = nil
	require.Equal(t, http.StatusNoContent, h.post(t, userCreated).Code)

	member, err := h.usersRepo.ByClerkID(ctx, "user_123")
	require.NoError(t, err)
	require.NotNil(t, member.InvitedBy)
	assert.Equal(t, inviter, *member.InvitedBy)
}

func TestWebhookKeepsTheInvitationPendingWhenTheProfileIsUnprocessable(t *testing.T) {
	t.Parallel()

	h := newHarness(t, nil)
	ctx := context.Background()
	inviter := uuid.New()
	_, err := h.inviteRepo.Create(ctx, invitations.Invitation{
		Email:     "alvaro@correo.com",
		InviterID: inviter,
		Status:    invitations.StatusPending,
	})
	require.NoError(t, err)

	// 422 tells Clerk to stop retrying, so this delivery is the last one for
	// this event. Burning the invitation here would strand the inviter
	// forever.
	require.Equal(t, http.StatusUnprocessableEntity, h.post(t, userCreatedWithoutUsername).Code)

	pending, err := h.inviteRepo.PendingByEmail(ctx, "alvaro@correo.com")
	require.NoError(t, err, "a rejected payload must not consume the invitation")
	assert.Equal(t, inviter, pending.InviterID)

	// Once the profile is fixed, user.updated projects the member and the
	// invitation is still there to say who invited them.
	require.Equal(t, http.StatusNoContent, h.post(t, strings.Replace(userCreated, "user.created", "user.updated", 1)).Code)

	member, err := h.usersRepo.ByClerkID(ctx, "user_123")
	require.NoError(t, err)
	require.NotNil(t, member.InvitedBy)
	assert.Equal(t, inviter, *member.InvitedBy)
}
