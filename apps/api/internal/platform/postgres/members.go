package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/postgres/sqlcgen"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// MemberRepository implements users.Repository and invitations.MemberDirectory.
type MemberRepository struct {
	queries *sqlcgen.Queries
}

// NewMemberRepository builds the Postgres-backed member repository.
func NewMemberRepository(pool *pgxpool.Pool) *MemberRepository {
	return &MemberRepository{queries: sqlcgen.New(pool)}
}

// ByClerkID returns users.ErrNotFound when no member matches.
func (r *MemberRepository) ByClerkID(ctx context.Context, clerkUserID string) (users.User, error) {
	row, err := r.queries.MemberByClerkID(ctx, clerkUserID)
	if err != nil {
		if isNoRows(err) {
			return users.User{}, users.ErrNotFound
		}

		return users.User{}, fmt.Errorf("select member by clerk id: %w", err)
	}

	return toDomainMember(row), nil
}

// ByID returns users.ErrNotFound when no member matches.
func (r *MemberRepository) ByID(ctx context.Context, id uuid.UUID) (users.User, error) {
	row, err := r.queries.MemberByID(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return users.User{}, users.ErrNotFound
		}

		return users.User{}, fmt.Errorf("select member by id: %w", err)
	}

	return toDomainMember(row), nil
}

// Upsert creates the member or refreshes its mutable profile fields.
func (r *MemberRepository) Upsert(ctx context.Context, user users.User) (users.User, error) {
	row, err := r.queries.UpsertMember(ctx, sqlcgen.UpsertMemberParams{
		ClerkUserID: user.ClerkUserID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		AvatarUrl:   user.AvatarURL,
		Email:       user.Email,
		InvitedBy:   user.InvitedBy,
	})
	if err != nil {
		return users.User{}, fmt.Errorf("upsert member: %w", err)
	}

	return toDomainMember(row), nil
}

// DeleteByClerkID removes a member; deleting an unknown one is a no-op.
func (r *MemberRepository) DeleteByClerkID(ctx context.Context, clerkUserID string) error {
	if err := r.queries.DeleteMemberByClerkID(ctx, clerkUserID); err != nil {
		return fmt.Errorf("delete member: %w", err)
	}

	return nil
}

// ExistsByEmail implements invitations.MemberDirectory.
func (r *MemberRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	exists, err := r.queries.MemberExistsByEmail(ctx, email)
	if err != nil {
		return false, fmt.Errorf("check member by email: %w", err)
	}

	return exists, nil
}
