package invitations_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations/invitationsmem"
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

func (r *stubRepository) ListByInviter(_ context.Context, _ uuid.UUID, _ *invitations.Cursor, _ int) ([]invitations.Invitation, error) {
	return r.created, nil
}

func (r *stubRepository) MarkAccepted(_ context.Context, _ string) error { return nil }

// ListGroup is unused by the Invite tests in this file; the ListGroup tests
// below exercise invitationsmem.Repository instead, whose ListGroup actually
// implements the keyset order ADR-0011 requires.
func (r *stubRepository) ListGroup(_ context.Context, _ *invitations.Cursor, _ int) ([]invitations.GroupEntry, error) {
	return nil, nil
}

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

// newMemBackedService builds a Service on top of the real invitationsmem
// repository, which is what actually implements the keyset order ADR-0011
// requires for both listings, unlike the local stubRepository above.
func newMemBackedService(t *testing.T) (*invitations.Service, *invitationsmem.Repository) {
	t.Helper()

	repo := invitationsmem.NewRepository()
	service := invitations.NewService(invitations.ServiceDeps{
		Sender:      &stubSender{id: "inv_clerk_1"},
		Repository:  repo,
		Members:     &stubMembers{existing: make(map[string]bool)},
		RedirectURL: "https://freakhub.local/registro",
	})

	return service, repo
}

func TestListGroupReturnsInvitationsFromEveryInviterNewestFirst(t *testing.T) {
	t.Parallel()

	service, repo := newMemBackedService(t)

	alvaro := uuid.New()
	bea := uuid.New()
	repo.RegisterMember(invitations.InviterSummary{ID: alvaro, Username: "alvaro", DisplayName: "Álvaro"})
	repo.RegisterMember(invitations.InviterSummary{ID: bea, Username: "bea", DisplayName: "Bea"})

	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	repo.Seed(invitations.Invitation{
		Email: "a@correo.com", InviterID: alvaro, Status: invitations.StatusPending, CreatedAt: base,
	})
	repo.Seed(invitations.Invitation{
		Email: "b@correo.com", InviterID: bea, Status: invitations.StatusAccepted, CreatedAt: base.Add(time.Hour),
	})

	entries, next, err := service.ListGroup(context.Background(), nil, 10)

	require.NoError(t, err)
	assert.Nil(t, next, "the last page must not carry a next cursor")
	require.Len(t, entries, 2)
	assert.Equal(t, "b@correo.com", entries[0].Email, "newest first")
	assert.Equal(t, "bea", entries[0].Inviter.Username)
	assert.Equal(t, invitations.StatusAccepted, entries[0].Status,
		"every status is included, not only pending")
	assert.Equal(t, "a@correo.com", entries[1].Email)
	assert.Equal(t, "alvaro", entries[1].Inviter.Username)
}

func TestListGroupPaginatesWithACursor(t *testing.T) {
	t.Parallel()

	service, repo := newMemBackedService(t)

	inviter := uuid.New()
	repo.RegisterMember(invitations.InviterSummary{ID: inviter, Username: "alvaro", DisplayName: "Álvaro"})

	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	repo.Seed(invitations.Invitation{Email: "a@correo.com", InviterID: inviter, Status: invitations.StatusPending, CreatedAt: base})
	repo.Seed(invitations.Invitation{Email: "b@correo.com", InviterID: inviter, Status: invitations.StatusPending, CreatedAt: base.Add(time.Hour)})
	repo.Seed(invitations.Invitation{Email: "c@correo.com", InviterID: inviter, Status: invitations.StatusPending, CreatedAt: base.Add(2 * time.Hour)})

	firstPage, cursor, err := service.ListGroup(context.Background(), nil, 2)
	require.NoError(t, err)
	require.NotNil(t, cursor, "a page that is not the last one must carry a cursor")
	require.Len(t, firstPage, 2)
	assert.Equal(t, "c@correo.com", firstPage[0].Email)
	assert.Equal(t, "b@correo.com", firstPage[1].Email)

	secondPage, nextCursor, err := service.ListGroup(context.Background(), cursor, 2)
	require.NoError(t, err)
	assert.Nil(t, nextCursor)
	require.Len(t, secondPage, 1)
	assert.Equal(t, "a@correo.com", secondPage[0].Email)
}

func TestListGroupRejectsAnOutOfRangeLimit(t *testing.T) {
	t.Parallel()

	service, _ := newMemBackedService(t)

	_, _, err := service.ListGroup(context.Background(), nil, 0)
	require.ErrorIs(t, err, invitations.ErrInvalidLimit)

	_, _, err = service.ListGroup(context.Background(), nil, 101)
	require.ErrorIs(t, err, invitations.ErrInvalidLimit)
}

func TestListMineReturnsOnlyTheCallersInvitationsNewestFirst(t *testing.T) {
	t.Parallel()

	service, repo := newMemBackedService(t)

	alvaro := uuid.New()
	bea := uuid.New()

	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	repo.Seed(invitations.Invitation{
		Email: "a@correo.com", InviterID: alvaro, Status: invitations.StatusPending, CreatedAt: base,
	})
	repo.Seed(invitations.Invitation{
		Email: "b@correo.com", InviterID: alvaro, Status: invitations.StatusAccepted, CreatedAt: base.Add(time.Hour),
	})
	repo.Seed(invitations.Invitation{
		Email: "c@correo.com", InviterID: bea, Status: invitations.StatusPending, CreatedAt: base.Add(2 * time.Hour),
	})

	sent, next, err := service.ListMine(context.Background(), alvaro, nil, 10)

	require.NoError(t, err)
	assert.Nil(t, next, "the last page must not carry a next cursor")
	require.Len(t, sent, 2, "another member's invitations are not the caller's")
	assert.Equal(t, "b@correo.com", sent[0].Email, "newest first")
	assert.Equal(t, invitations.StatusAccepted, sent[0].Status,
		"every status is included, not only pending")
	assert.Equal(t, "a@correo.com", sent[1].Email)
}

func TestListMinePaginatesWithACursor(t *testing.T) {
	t.Parallel()

	service, repo := newMemBackedService(t)

	inviter := uuid.New()
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	repo.Seed(invitations.Invitation{Email: "a@correo.com", InviterID: inviter, Status: invitations.StatusPending, CreatedAt: base})
	repo.Seed(invitations.Invitation{Email: "b@correo.com", InviterID: inviter, Status: invitations.StatusPending, CreatedAt: base.Add(time.Hour)})
	repo.Seed(invitations.Invitation{Email: "c@correo.com", InviterID: inviter, Status: invitations.StatusPending, CreatedAt: base.Add(2 * time.Hour)})

	firstPage, cursor, err := service.ListMine(context.Background(), inviter, nil, 2)
	require.NoError(t, err)
	require.NotNil(t, cursor, "a page that is not the last one must carry a cursor")
	require.Len(t, firstPage, 2)
	assert.Equal(t, "c@correo.com", firstPage[0].Email)
	assert.Equal(t, "b@correo.com", firstPage[1].Email)

	secondPage, nextCursor, err := service.ListMine(context.Background(), inviter, cursor, 2)
	require.NoError(t, err)
	assert.Nil(t, nextCursor)
	require.Len(t, secondPage, 1)
	assert.Equal(t, "a@correo.com", secondPage[0].Email)
}

// TestListMineTieBreaksARepeatedTimestampByID is the case the index this
// change adds exists for: created_at alone is not unique, so without the id
// tiebreak a page boundary between two rows sharing a timestamp would skip
// one or hand it over twice.
func TestListMineTieBreaksARepeatedTimestampByID(t *testing.T) {
	t.Parallel()

	service, repo := newMemBackedService(t)

	inviter := uuid.New()
	sameInstant := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for _, email := range []string{"a@correo.com", "b@correo.com", "c@correo.com"} {
		repo.Seed(invitations.Invitation{
			Email: email, InviterID: inviter, Status: invitations.StatusPending, CreatedAt: sameInstant,
		})
	}

	seen := map[string]bool{}

	var cursor *invitations.Cursor
	for range 3 {
		page, next, err := service.ListMine(context.Background(), inviter, cursor, 1)
		require.NoError(t, err)
		require.Len(t, page, 1)
		require.Falsef(t, seen[page[0].Email], "%s was handed over twice", page[0].Email)
		seen[page[0].Email] = true
		cursor = next
	}

	assert.Nil(t, cursor, "three rows read one at a time is the whole list")
	assert.Len(t, seen, 3, "no row may be skipped across page boundaries")
}

func TestListMineRejectsAnOutOfRangeLimit(t *testing.T) {
	t.Parallel()

	service, _ := newMemBackedService(t)
	inviter := uuid.New()

	_, _, err := service.ListMine(context.Background(), inviter, nil, 0)
	require.ErrorIs(t, err, invitations.ErrInvalidLimit)

	_, _, err = service.ListMine(context.Background(), inviter, nil, 101)
	require.ErrorIs(t, err, invitations.ErrInvalidLimit)
}

func TestPendingByEmailResolvesTheInviterWithoutClosingTheInvitation(t *testing.T) {
	t.Parallel()

	repo := invitationsmem.NewRepository()
	service := invitations.NewService(invitations.ServiceDeps{
		Sender:     invitationsmem.NewSender(),
		Repository: repo,
		Members:    invitationsmem.NewMembers(),
	})
	ctx := context.Background()

	inviter := uuid.New()
	_, err := repo.Create(ctx, invitations.Invitation{
		Email:     "alex@correo.com",
		InviterID: inviter,
		Status:    invitations.StatusPending,
	})
	require.NoError(t, err)

	found, err := service.PendingByEmail(ctx, "  Alex@Correo.com  ")

	require.NoError(t, err)
	assert.Equal(t, inviter, found.InviterID)

	// Reading must not consume it: the webhook only closes the invitation once
	// the member it belongs to actually exists.
	stillPending, err := repo.PendingByEmail(ctx, "alex@correo.com")
	require.NoError(t, err, "looking the invitation up must leave it pending")
	assert.Equal(t, invitations.StatusPending, stillPending.Status)
}

func TestPendingByEmailReportsNotFoundWhenNothingIsPending(t *testing.T) {
	t.Parallel()

	repo := invitationsmem.NewRepository()
	service := invitations.NewService(invitations.ServiceDeps{
		Sender:     invitationsmem.NewSender(),
		Repository: repo,
		Members:    invitationsmem.NewMembers(),
	})

	_, err := service.PendingByEmail(context.Background(), "nadie@correo.com")

	assert.ErrorIs(t, err, invitations.ErrNotFound)
}
