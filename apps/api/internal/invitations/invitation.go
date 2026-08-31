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
