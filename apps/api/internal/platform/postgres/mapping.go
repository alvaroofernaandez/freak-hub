package postgres

import (
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/postgres/sqlcgen"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// uniqueViolation is the SQLSTATE Postgres raises for a duplicate key.
const uniqueViolation = "23505"

// isNoRows reports whether the error means "nothing matched".
func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}

// isUniqueViolation reports whether the error is a duplicate key, optionally
// narrowed to a specific constraint name.
func isUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != uniqueViolation {
		return false
	}

	return constraint == "" || pgErr.ConstraintName == constraint
}

func toTime(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Time{}
	}

	return value.Time
}

func toTimePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}

	at := value.Time

	return &at
}

func toDomainMember(row sqlcgen.Member) users.User {
	return users.User{
		ID:          row.ID,
		ClerkUserID: row.ClerkUserID,
		Username:    row.Username,
		DisplayName: row.DisplayName,
		AvatarURL:   row.AvatarUrl,
		InvitedBy:   row.InvitedBy,
		CreatedAt:   toTime(row.CreatedAt),
		UpdatedAt:   toTime(row.UpdatedAt),
	}
}

func toDomainInvitation(row sqlcgen.Invitation) invitations.Invitation {
	return invitations.Invitation{
		ID:                row.ID,
		ClerkInvitationID: row.ClerkInvitationID,
		Email:             row.Email,
		InviterID:         row.InviterID,
		Status:            invitations.Status(row.Status),
		CreatedAt:         toTime(row.CreatedAt),
		AcceptedAt:        toTimePtr(row.AcceptedAt),
	}
}
