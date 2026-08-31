// Package users owns the member identity inside Freak Hub.
//
// Clerk is the source of truth for authentication; this package owns the local
// projection of a member, which is what every other domain (collections, wish
// lists, recommendations) will point at with a foreign key.
package users

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// Domain errors. Transport layers map these onto status codes; nothing outside
// this package should invent its own equivalents.
var (
	ErrNotFound        = errors.New("user not found")
	ErrMissingClerkID  = errors.New("clerk user id is required")
	ErrInvalidUsername = errors.New("username is required")
)

// User is a member of the community.
type User struct {
	ID          uuid.UUID
	ClerkUserID string
	Username    string
	DisplayName string
	AvatarURL   string
	// Email mirrors the primary address Clerk holds. It is what lets an
	// invitation be matched to the member that finally accepted it.
	Email string
	// InvitedBy records who brought this member in. Nil for the founders.
	InvitedBy *uuid.UUID
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ClerkProfile is the subset of a Clerk user this service cares about. It is a
// plain struct rather than the SDK type so the domain does not depend on Clerk.
type ClerkProfile struct {
	ClerkUserID string
	Username    string
	DisplayName string
	AvatarURL   string
	Email       string
}
