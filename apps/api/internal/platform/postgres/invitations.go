package postgres

import (
	"context"
	"fmt"
	"math"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/postgres/sqlcgen"
)

// InvitationRepository implements invitations.Repository.
type InvitationRepository struct {
	queries *sqlcgen.Queries
}

// NewInvitationRepository builds the Postgres-backed invitation repository.
func NewInvitationRepository(pool *pgxpool.Pool) *InvitationRepository {
	return &InvitationRepository{queries: sqlcgen.New(pool)}
}

// PendingByEmail returns invitations.ErrNotFound when nothing is pending.
func (r *InvitationRepository) PendingByEmail(ctx context.Context, email string) (invitations.Invitation, error) {
	row, err := r.queries.PendingInvitationByEmail(ctx, email)
	if err != nil {
		if isNoRows(err) {
			return invitations.Invitation{}, invitations.ErrNotFound
		}

		return invitations.Invitation{}, fmt.Errorf("select pending invitation: %w", err)
	}

	return toDomainInvitation(row), nil
}

// Create records an invitation Clerk has already accepted to send.
func (r *InvitationRepository) Create(ctx context.Context, invitation invitations.Invitation) (invitations.Invitation, error) {
	row, err := r.queries.CreateInvitation(ctx, sqlcgen.CreateInvitationParams{
		ClerkInvitationID: invitation.ClerkInvitationID,
		Email:             invitation.Email,
		InviterID:         invitation.InviterID,
		Status:            sqlcgen.InvitationStatus(invitation.Status),
	})
	if err != nil {
		// The partial unique index is the last line of defence against two
		// members inviting the same person at the same instant.
		if isUniqueViolation(err, "invitations_pending_email_idx") {
			return invitations.Invitation{}, invitations.ErrAlreadySent
		}

		return invitations.Invitation{}, fmt.Errorf("insert invitation: %w", err)
	}

	return toDomainInvitation(row), nil
}

// ListByInviter returns a member's invitations, newest first.
func (r *InvitationRepository) ListByInviter(ctx context.Context, inviterID uuid.UUID) ([]invitations.Invitation, error) {
	rows, err := r.queries.InvitationsByInviter(ctx, inviterID)
	if err != nil {
		return nil, fmt.Errorf("select invitations by inviter: %w", err)
	}

	found := make([]invitations.Invitation, 0, len(rows))
	for _, row := range rows {
		found = append(found, toDomainInvitation(row))
	}

	return found, nil
}

// ListGroup returns a page of every invitation the group has ever sent,
// newest first, joined with the inviting member (ADR-0011).
func (r *InvitationRepository) ListGroup(ctx context.Context, after *invitations.Cursor, limit int) ([]invitations.GroupEntry, error) {
	if limit < 0 || limit > math.MaxInt32 {
		return nil, fmt.Errorf("list group invitations: limit %d out of range", limit)
	}

	params := sqlcgen.ListGroupInvitationsParams{PageLimit: int32(limit)}
	if after != nil {
		params.AfterCreatedAt = pgtype.Timestamptz{Time: after.CreatedAt, Valid: true}
		id := after.ID
		params.AfterID = &id
	}

	rows, err := r.queries.ListGroupInvitations(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("select group invitations: %w", err)
	}

	entries := make([]invitations.GroupEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, toDomainGroupEntry(row))
	}

	return entries, nil
}

// MarkAccepted closes the pending invitation for an address.
func (r *InvitationRepository) MarkAccepted(ctx context.Context, email string) error {
	if err := r.queries.MarkInvitationAccepted(ctx, email); err != nil {
		return fmt.Errorf("mark invitation accepted: %w", err)
	}

	return nil
}
