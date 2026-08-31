// Package invitationsmem provides in-memory doubles for the invitation ports.
package invitationsmem

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
)

// Repository stores invitations in a slice, keyed by email for lookups.
type Repository struct {
	mu    sync.RWMutex
	items []invitations.Invitation
}

// NewRepository builds an empty in-memory invitation repository.
func NewRepository() *Repository { return &Repository{} }

// PendingByEmail implements invitations.Repository.
func (r *Repository) PendingByEmail(_ context.Context, email string) (invitations.Invitation, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, item := range r.items {
		if item.Email == email && item.Status == invitations.StatusPending {
			return item, nil
		}
	}

	return invitations.Invitation{}, invitations.ErrNotFound
}

// Create implements invitations.Repository.
func (r *Repository) Create(_ context.Context, invitation invitations.Invitation) (invitations.Invitation, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	invitation.ID = uuid.New()
	invitation.CreatedAt = time.Now().UTC()
	r.items = append(r.items, invitation)

	return invitation, nil
}

// ListByInviter implements invitations.Repository.
func (r *Repository) ListByInviter(_ context.Context, inviterID uuid.UUID) ([]invitations.Invitation, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var found []invitations.Invitation
	for _, item := range r.items {
		if item.InviterID == inviterID {
			found = append(found, item)
		}
	}

	return found, nil
}

// MarkAccepted implements invitations.Repository.
func (r *Repository) MarkAccepted(_ context.Context, email string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now().UTC()
	for i, item := range r.items {
		if item.Email == email && item.Status == invitations.StatusPending {
			r.items[i].Status = invitations.StatusAccepted
			r.items[i].AcceptedAt = &now
		}
	}

	return nil
}

// Sender records what would have been sent to Clerk.
type Sender struct {
	mu     sync.Mutex
	Emails []string
	Err    error
}

// NewSender builds a sender that records what it would have sent.
func NewSender() *Sender { return &Sender{} }

// Send implements invitations.Sender.
func (s *Sender) Send(_ context.Context, email, _ string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Err != nil {
		return "", s.Err
	}

	s.Emails = append(s.Emails, email)

	return "inv_" + uuid.NewString(), nil
}

// Members is a MemberDirectory backed by a set of known emails.
type Members struct {
	Known map[string]bool
}

// NewMembers builds an empty member directory.
func NewMembers() *Members { return &Members{Known: make(map[string]bool)} }

// ExistsByEmail implements invitations.MemberDirectory.
func (m *Members) ExistsByEmail(_ context.Context, email string) (bool, error) {
	return m.Known[email], nil
}
