package invitations

import (
	"context"

	"github.com/google/uuid"
)

// Sender is the outbound port towards Clerk. The real adapter calls the Clerk
// Backend API, which is what actually delivers the email and unlocks sign-up.
type Sender interface {
	Send(ctx context.Context, email, redirectURL string) (clerkInvitationID string, err error)
}

// Repository persists the local trail of who invited whom.
type Repository interface {
	// PendingByEmail returns ErrNotFound when nothing is pending for that email.
	PendingByEmail(ctx context.Context, email string) (Invitation, error)
	Create(ctx context.Context, invitation Invitation) (Invitation, error)
	ListByInviter(ctx context.Context, inviterID uuid.UUID) ([]Invitation, error)
	MarkAccepted(ctx context.Context, email string) error
	// ListGroup returns a page of every invitation the group has ever sent,
	// newest first, joined with the identity of whoever sent it. after is
	// nil for the first page; otherwise only rows strictly after that
	// position are returned. It returns at most limit rows (ADR-0011).
	ListGroup(ctx context.Context, after *Cursor, limit int) ([]GroupEntry, error)
}

// MemberDirectory answers whether an email already belongs to a member, so we
// never send an invitation to somebody who is already inside.
type MemberDirectory interface {
	ExistsByEmail(ctx context.Context, email string) (bool, error)
}
