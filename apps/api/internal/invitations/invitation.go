// Package invitations owns the only door into Freak Hub.
//
// The Clerk instance runs in `restricted` mode, so an email address can only
// complete sign-up if Clerk holds a pending invitation for it. Every member can
// invite, without a quota, and each invitation records who sent it so the
// community keeps a trail of how it grew.
package invitations

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// Domain errors. Transport layers map these onto status codes.
var (
	ErrInvalidEmail   = errors.New("invitation email is not valid")
	ErrAlreadySent    = errors.New("an invitation is already pending for this email")
	ErrAlreadyMember  = errors.New("this email already belongs to a member")
	ErrNotFound       = errors.New("invitation not found")
	ErrMissingInviter = errors.New("inviter is required")
	// ErrInvalidLimit is returned by ListGroup when limit falls outside
	// [MinListLimit, MaxListLimit] (ADR-0011).
	ErrInvalidLimit = errors.New("limit must be between 1 and 100")
)

// ListGroup page bounds (ADR-0011:
// docs/decisions/0011-paginacion-por-cursor.md).
const (
	MinListLimit     = 1
	MaxListLimit     = 100
	DefaultListLimit = 25
)

// Status mirrors the lifecycle Clerk reports for an invitation.
type Status string

// The invitation lifecycle, as Clerk reports it.
const (
	StatusPending  Status = "pending"
	StatusAccepted Status = "accepted"
	StatusRevoked  Status = "revoked"
)

// Invitation is a pending or resolved ticket into the community.
type Invitation struct {
	ID uuid.UUID
	// ClerkInvitationID ties the local row to the invitation Clerk actually sent.
	ClerkInvitationID string
	Email             string
	InviterID         uuid.UUID
	Status            Status
	CreatedAt         time.Time
	AcceptedAt        *time.Time
}

// Cursor is an invitation's position in the stable group order ListGroup
// uses for keyset pagination: created_at descending (newest first), tie-broken
// by id descending (ADR-0011: docs/decisions/0011-paginacion-por-cursor.md).
type Cursor struct {
	CreatedAt time.Time
	ID        uuid.UUID
}

// InviterSummary is the public identity of the member who sent an
// invitation, resolved alongside it so the group can see who invited whom
// without a lookup per row.
type InviterSummary struct {
	ID          uuid.UUID
	Username    string
	DisplayName string
	AvatarURL   string
}

// GroupEntry pairs an invitation with the member who sent it. It is what
// ListGroup answers with: the whole group's invitations, not just the
// caller's, so two members can notice they are about to invite the same
// address.
type GroupEntry struct {
	Invitation
	Inviter InviterSummary
}
