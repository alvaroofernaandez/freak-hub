// Package invitationsmem provides in-memory doubles for the invitation ports.
package invitationsmem

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
)

// Repository stores invitations in a slice, keyed by email for lookups. The
// members map stands in for the JOIN the Postgres adapter performs against
// the members table, so ListGroup can resolve who sent each invitation.
type Repository struct {
	mu      sync.RWMutex
	items   []invitations.Invitation
	members map[uuid.UUID]invitations.InviterSummary
	// NowFunc returns the creation timestamp Create uses. Tests can pin it to
	// make listing order deterministic instead of depending on wall-clock
	// timing.
	NowFunc func() time.Time
	// MarkAcceptedErr makes MarkAccepted fail, so a test can check that
	// closing an invitation is bookkeeping and never blocks the caller.
	MarkAcceptedErr error
}

// NewRepository builds an empty in-memory invitation repository.
func NewRepository() *Repository {
	return &Repository{
		members: make(map[uuid.UUID]invitations.InviterSummary),
		NowFunc: time.Now,
	}
}

// RegisterMember makes a member's public identity available to ListGroup,
// mirroring the row the Postgres adapter would find via its JOIN.
func (r *Repository) RegisterMember(summary invitations.InviterSummary) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.members[summary.ID] = summary
}

// Seed inserts an invitation directly, bypassing Create's side effects, for
// tests that need full control over its fields (status, CreatedAt, id).
func (r *Repository) Seed(invitation invitations.Invitation) invitations.Invitation {
	r.mu.Lock()
	defer r.mu.Unlock()

	if invitation.ID == uuid.Nil {
		invitation.ID = uuid.New()
	}

	r.items = append(r.items, invitation)

	return invitation
}

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
	invitation.CreatedAt = r.NowFunc().UTC()
	r.items = append(r.items, invitation)

	return invitation, nil
}

// ListByInviter implements invitations.Repository. It applies the same
// keyset order as ListGroup, narrowed to one inviter (ADR-0011).
func (r *Repository) ListByInviter(
	_ context.Context, inviterID uuid.UUID, after *invitations.Cursor, limit int,
) ([]invitations.Invitation, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	mine := make([]invitations.Invitation, 0, len(r.items))
	for _, item := range r.items {
		if item.InviterID == inviterID {
			mine = append(mine, item)
		}
	}

	return pageOf(mine, after, limit), nil
}

// MarkAccepted implements invitations.Repository.
func (r *Repository) MarkAccepted(_ context.Context, email string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.MarkAcceptedErr != nil {
		return r.MarkAcceptedErr
	}

	now := time.Now().UTC()
	for i, item := range r.items {
		if item.Email == email && item.Status == invitations.StatusPending {
			r.items[i].Status = invitations.StatusAccepted
			r.items[i].AcceptedAt = &now
		}
	}

	return nil
}

// ListGroup implements invitations.Repository. It orders by created_at
// descending, tie-broken by id descending, matching the keyset order the
// Postgres adapter uses (ADR-0011).
func (r *Repository) ListGroup(_ context.Context, after *invitations.Cursor, limit int) ([]invitations.GroupEntry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	rows := pageOf(r.items, after, limit)

	page := make([]invitations.GroupEntry, 0, len(rows))
	for _, item := range rows {
		summary, ok := r.members[item.InviterID]
		if !ok {
			summary = invitations.InviterSummary{ID: item.InviterID}
		}

		page = append(page, invitations.GroupEntry{Invitation: item, Inviter: summary})
	}

	return page, nil
}

// pageOf is the keyset walk both listings share: sort into the stable order
// ADR-0011 fixes, skip everything up to and including after, and hand back at
// most limit rows. Doing it once is what keeps the two doubles from drifting
// apart in a way the Postgres adapter never would.
func pageOf(items []invitations.Invitation, after *invitations.Cursor, limit int) []invitations.Invitation {
	sorted := make([]invitations.Invitation, len(items))
	copy(sorted, items)
	sort.Slice(sorted, func(i, j int) bool {
		return isBeforeInListOrder(sorted[i], sorted[j])
	})

	start := 0
	if after != nil {
		start = sort.Search(len(sorted), func(i int) bool {
			return isAfterCursor(sorted[i], *after)
		})
	}

	end := start + limit
	if end > len(sorted) {
		end = len(sorted)
	}

	if end < start {
		end = start
	}

	return sorted[start:end]
}

// isBeforeInListOrder reports whether a sorts strictly before b in the stable
// listing order (ADR-0011): created_at descending, id as tiebreak.
func isBeforeInListOrder(a, b invitations.Invitation) bool {
	if !a.CreatedAt.Equal(b.CreatedAt) {
		return a.CreatedAt.After(b.CreatedAt)
	}

	return a.ID.String() > b.ID.String()
}

// isAfterCursor reports whether item comes strictly after cursor in that same
// order.
func isAfterCursor(item invitations.Invitation, cursor invitations.Cursor) bool {
	if !item.CreatedAt.Equal(cursor.CreatedAt) {
		return item.CreatedAt.Before(cursor.CreatedAt)
	}

	return item.ID.String() < cursor.ID.String()
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
