package invitations_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
)

type stubSender struct {
	id           string
	err          error
	sentEmails   []string
	sentRedirect string
}

func (s *stubSender) Send(_ context.Context, email, redirectURL string) (string, error) {
	s.sentEmails = append(s.sentEmails, email)
	s.sentRedirect = redirectURL

	if s.err != nil {
		return "", s.err
	}

	return s.id, nil
}

type stubRepository struct {
	pending   map[string]invitations.Invitation
	created   []invitations.Invitation
	createErr error
}

func newStubRepository() *stubRepository {
	return &stubRepository{pending: make(map[string]invitations.Invitation)}
}

func (r *stubRepository) PendingByEmail(_ context.Context, email string) (invitations.Invitation, error) {
	invitation, ok := r.pending[email]
	if !ok {
		return invitations.Invitation{}, invitations.ErrNotFound
	}

	return invitation, nil
}

func (r *stubRepository) Create(_ context.Context, invitation invitations.Invitation) (invitations.Invitation, error) {
	if r.createErr != nil {
		return invitations.Invitation{}, r.createErr
	}

	invitation.ID = uuid.New()
	r.created = append(r.created, invitation)

	return invitation, nil
}

func (r *stubRepository) ListByInviter(_ context.Context, _ uuid.UUID) ([]invitations.Invitation, error) {
	return r.created, nil
}

func (r *stubRepository) MarkAccepted(_ context.Context, _ string) error { return nil }

type stubMembers struct {
	existing map[string]bool
	err      error
}

func (m *stubMembers) ExistsByEmail(_ context.Context, email string) (bool, error) {
	if m.err != nil {
		return false, m.err
	}

	return m.existing[email], nil
}

type harness struct {
	service *invitations.Service
	sender  *stubSender
	repo    *stubRepository
	members *stubMembers
}

func newHarness(t *testing.T) *harness {
	t.Helper()

	sender := &stubSender{id: "inv_clerk_1"}
	repo := newStubRepository()
	members := &stubMembers{existing: make(map[string]bool)}

	return &harness{
		service: invitations.NewService(invitations.ServiceDeps{
			Sender:      sender,
			Repository:  repo,
			Members:     members,
			RedirectURL: "https://freakhub.local/registro",
		}),
		sender:  sender,
		repo:    repo,
		members: members,
	}
}

func TestInviteSendsTheInvitationAndRecordsTheInviter(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	inviter := uuid.New()

	invitation, err := h.service.Invite(context.Background(), inviter, "amigo@correo.com")

	require.NoError(t, err)
	assert.Equal(t, "amigo@correo.com", invitation.Email)
	assert.Equal(t, inviter, invitation.InviterID)
	assert.Equal(t, invitations.StatusPending, invitation.Status)
	assert.Equal(t, "inv_clerk_1", invitation.ClerkInvitationID)
	assert.Equal(t, []string{"amigo@correo.com"}, h.sender.sentEmails)
	assert.Equal(t, "https://freakhub.local/registro", h.sender.sentRedirect)
	assert.Len(t, h.repo.created, 1)
}

func TestInviteNormalisesTheEmail(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	invitation, err := h.service.Invite(context.Background(), uuid.New(), "  Amigo@Correo.COM ")

	require.NoError(t, err)
	assert.Equal(t, "amigo@correo.com", invitation.Email)
	assert.Equal(t, []string{"amigo@correo.com"}, h.sender.sentEmails)
}

func TestInviteRejectsAnInvalidEmail(t *testing.T) {
	t.Parallel()

	for _, email := range []string{"", "   ", "no-arroba", "@correo.com", "amigo@"} {
		h := newHarness(t)

		_, err := h.service.Invite(context.Background(), uuid.New(), email)

		require.ErrorIs(t, err, invitations.ErrInvalidEmail, "email %q", email)
		assert.Empty(t, h.sender.sentEmails, "an invalid email must never reach Clerk")
	}
}

func TestInviteRejectsAnInvitationWithoutInviter(t *testing.T) {
	t.Parallel()

	h := newHarness(t)

	_, err := h.service.Invite(context.Background(), uuid.Nil, "amigo@correo.com")

	require.ErrorIs(t, err, invitations.ErrMissingInviter)
	assert.Empty(t, h.sender.sentEmails)
}

func TestInviteRefusesToDuplicateAPendingInvitation(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	h.repo.pending["amigo@correo.com"] = invitations.Invitation{Email: "amigo@correo.com"}

	_, err := h.service.Invite(context.Background(), uuid.New(), "amigo@correo.com")

	require.ErrorIs(t, err, invitations.ErrAlreadySent)
	assert.Empty(t, h.sender.sentEmails)
}

func TestInviteRefusesToInviteAnExistingMember(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	h.members.existing["amigo@correo.com"] = true

	_, err := h.service.Invite(context.Background(), uuid.New(), "amigo@correo.com")

	require.ErrorIs(t, err, invitations.ErrAlreadyMember)
	assert.Empty(t, h.sender.sentEmails)
}

func TestInviteDoesNotRecordAnInvitationClerkRefused(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	h.sender.err = errors.New("clerk is down")

	_, err := h.service.Invite(context.Background(), uuid.New(), "amigo@correo.com")

	require.Error(t, err)
	assert.Empty(t, h.repo.created, "no local row may outlive a failed send")
}

func TestInviteImposesNoQuotaOnAMember(t *testing.T) {
	t.Parallel()

	h := newHarness(t)
	inviter := uuid.New()
	ctx := context.Background()

	for _, email := range []string{"a@correo.com", "b@correo.com", "c@correo.com", "d@correo.com"} {
		_, err := h.service.Invite(ctx, inviter, email)
		require.NoError(t, err)
	}

	assert.Len(t, h.repo.created, 4)
}
