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
	// ErrInvalidLimit is returned by List when limit falls outside
	// [MinListLimit, MaxListLimit] (ADR-0011).
	ErrInvalidLimit = errors.New("limit must be between 1 and 100")

	// The errors below back UpdateProfile and UploadAvatar (PATCH /v1/me and
	// POST /v1/me/avatar). They are all checked locally, before Clerk is
	// ever called.
	ErrNoProfileChanges      = errors.New("at least one field must be provided")
	ErrNameTooLong           = errors.New("name must be at most 100 characters")
	ErrUsernameInvalidLength = errors.New("username must be between 3 and 24 characters")
	ErrUsernameNumericOnly   = errors.New("username cannot be only digits")
	// ErrUsernameTaken is what UpdateProfile returns when Clerk reports the
	// requested username already belongs to somebody else.
	ErrUsernameTaken         = errors.New("username is already taken")
	ErrAvatarTooLarge        = errors.New("avatar exceeds the maximum allowed size")
	ErrAvatarUnsupportedType = errors.New("avatar content type is not supported")
)

// List page bounds shared by every caller of Service.List (ADR-0011:
// docs/decisions/0011-paginacion-por-cursor.md).
const (
	MinListLimit     = 1
	MaxListLimit     = 100
	DefaultListLimit = 25
)

// Profile-edit bounds shared by UpdateProfile and UploadAvatar.
const (
	MaxNameLength     = 100
	MinUsernameLength = 3
	MaxUsernameLength = 24
	// MaxAvatarBytes is a project-level choice (not a Clerk limit): 5 MiB is
	// generous for a profile picture while keeping the upload fast on a
	// mobile connection.
	MaxAvatarBytes = 5 << 20
)

// AllowedAvatarContentTypes are the MIME types UploadAvatar accepts, sniffed
// from the uploaded bytes rather than trusted from the client (see
// internal/api's sniffContentType).
var AllowedAvatarContentTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

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

// Cursor is a member's position in the stable member-since order ADR-0011
// requires for keyset pagination: created_at ascending, tie-broken by id. It
// lets List resume exactly where a previous page left off.
type Cursor struct {
	CreatedAt time.Time
	ID        uuid.UUID
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
