package users

import (
	"context"

	"github.com/google/uuid"
)

// Repository is the outbound port for member persistence. The Postgres adapter
// implements it; the tests use an in-memory double.
type Repository interface {
	// ByClerkID returns ErrNotFound when no member matches.
	ByClerkID(ctx context.Context, clerkUserID string) (User, error)
	// ByEmail resolves the member an invitation was addressed to, if any.
	ByID(ctx context.Context, id uuid.UUID) (User, error)
	// Upsert creates the member or updates the mutable profile fields, keyed by
	// ClerkUserID. It must be safe to call repeatedly with the same payload.
	Upsert(ctx context.Context, user User) (User, error)
	// DeleteByClerkID removes a member. Deleting an unknown member is not an error.
	DeleteByClerkID(ctx context.Context, clerkUserID string) error
}
