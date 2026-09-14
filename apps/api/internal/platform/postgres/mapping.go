package postgres

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/postgres/sqlcgen"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// The SQLSTATEs this package translates. They are discriminated by
// constraint name as well as by code, because two violations of the same class
// mean different things to whoever is waiting for the answer: a duplicate on
// library_entries_member_work_idx is "you already have this", a duplicate on
// works_source_idx is "somebody already imported this".
const (
	uniqueViolation     = "23505"
	foreignKeyViolation = "23503"
	// The two ways Postgres says "those bytes cannot live in this column":
	// 22021 for a byte sequence a text column cannot encode, 22P05 for the
	// escape a jsonb column will not take. They need no constraint name —
	// there is no constraint, only the encoding.
	characterNotInRepertoire = "22021"
	unsupportedUnicodeEscape = "22P05"
)

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

// isForeignKeyViolation reports whether the error is a reference to a row that
// is not there, optionally narrowed to a specific constraint name.
func isForeignKeyViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != foreignKeyViolation {
		return false
	}

	return constraint == "" || pgErr.ConstraintName == constraint
}

// asUnstorableText turns those two SQLSTATEs into library.ErrUnstorableText,
// and returns nil for anything else.
//
// It is the belt to the domain's braces, and the reason it exists is a score
// rather than a fear: three rounds of review found three different ways for
// client bytes to meet a storage constraint the domain had not modelled — an
// int4 ceiling, U+0000, invalid UTF-8 — and all three reached the caller as a
// 500. The domain rules are still the primary defence, because they answer
// precisely and they sit where every caller passes; what they cannot do is
// cover the kind nobody has thought of yet.
//
// So this is not expected to fire. If it does, the domain is missing a rule,
// and the two things that follow from that are both deliberate: the caller
// gets a 400, because the request really was unusable and a 500 would blame
// the wrong side, and the log keeps the SQLSTATE so whoever reads it knows
// which rule to go and write.
func asUnstorableText(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return nil
	}

	if pgErr.Code != characterNotInRepertoire && pgErr.Code != unsupportedUnicodeEscape {
		return nil
	}

	return fmt.Errorf("%w: %s (SQLSTATE %s)", library.ErrUnstorableText, pgErr.Message, pgErr.Code)
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

func toDomainGroupEntry(row sqlcgen.ListGroupInvitationsRow) invitations.GroupEntry {
	return invitations.GroupEntry{
		Invitation: invitations.Invitation{
			ID:        row.ID,
			Email:     row.Email,
			InviterID: row.InviterID,
			Status:    invitations.Status(row.Status),
			CreatedAt: toTime(row.CreatedAt),
		},
		Inviter: invitations.InviterSummary{
			ID:          row.InviterID,
			Username:    row.InviterUsername,
			DisplayName: row.InviterDisplayName,
			AvatarURL:   row.InviterAvatarUrl,
		},
	}
}

// toText turns a NULL text column into the empty string the domain declares
// for it. Work.CoverURL, Work.Synopsis and Work.SourceID are plain strings
// precisely because "absent" and "empty" mean the same thing for them; Entry's
// Note is a *string and therefore keeps its own nil.
func toText(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}

// fromText is the other half: an empty string is written as NULL rather than
// as ”. For source_id that is not a preference but the schema's own rule —
// works_source_id_matches_source refuses a blank external id, because an empty
// string in a deduplication key is a value meaning "unknown" wearing the
// clothes of one meaning "this exact anime".
func fromText(value string) *string {
	if value == "" {
		return nil
	}

	return &value
}

func toIntPtr(value *int32) *int {
	if value == nil {
		return nil
	}

	widened := int(*value)

	return &widened
}

// fromIntPtr narrows an optional domain int onto the int4 the column is. The
// range check is not ceremony: on a 64-bit platform a silent truncation would
// store a rating of 4294967297 as 1, which is a perfectly valid score.
func fromIntPtr(value *int, field string) (*int32, error) {
	if value == nil {
		return nil, nil //nolint:nilnil // an absent optional column is nil, not an error
	}

	narrowed, err := fromInt(*value, field)
	if err != nil {
		return nil, err
	}

	return &narrowed, nil
}

func fromInt(value int, field string) (int32, error) {
	if value < math.MinInt32 || value > math.MaxInt32 {
		return 0, fmt.Errorf("%s %d does not fit an int4 column", field, value)
	}

	return int32(value), nil
}

func fromTimePtr(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}

	return pgtype.Timestamptz{Time: *value, Valid: true}
}

// toMetadata reads the jsonb column back into the open map the domain uses.
//
// A row holding the jsonb scalar `null` unmarshals to a nil map, and that is
// the honest reading of it: nobody enriched this work. fromMetadata makes sure
// this adapter never writes such a row in the first place.
func toMetadata(raw []byte) (library.Metadata, error) {
	if len(raw) == 0 {
		return library.Metadata{}, nil
	}

	var metadata library.Metadata
	if err := json.Unmarshal(raw, &metadata); err != nil {
		return nil, fmt.Errorf("decode work metadata: %w", err)
	}

	if metadata == nil {
		return library.Metadata{}, nil
	}

	return metadata, nil
}

// fromMetadata is where the jsonb `null` door is closed, and it is worth being
// explicit about why the query's COALESCE is not enough.
//
// `metadata` is jsonb NOT NULL DEFAULT '{}'. COALESCE($n::jsonb, '{}') catches
// SQL NULL — the case where the parameter is absent. It does not catch the
// jsonb scalar `null`, which is a valid jsonb value, satisfies NOT NULL and
// arrives whenever something marshals a nil Go map. A row that holds it looks
// fine until somebody reads metadata->>'episodes' and gets NULL instead of a
// missing key, which for Work.Total() is the difference between "still airing"
// and "no episodes at all".
//
// So an absent or empty Metadata is sent as SQL NULL and lands on the column's
// own default. The handler that decodes "metadata": null (issue #9) does not
// have to defend against it: by the time the value reaches here it is a nil
// map, and a nil map never becomes the four bytes `null`.
func fromMetadata(metadata library.Metadata) ([]byte, error) {
	if len(metadata) == 0 {
		return nil, nil
	}

	raw, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("encode work metadata: %w", err)
	}

	return raw, nil
}

func toDomainWork(row sqlcgen.Work) (library.Work, error) {
	metadata, err := toMetadata(row.Metadata)
	if err != nil {
		return library.Work{}, err
	}

	return library.Work{
		ID:          row.ID,
		Title:       row.Title,
		Category:    library.Category(row.Category),
		Source:      library.Source(row.Source),
		SourceID:    toText(row.SourceID),
		CoverURL:    toText(row.CoverUrl),
		Synopsis:    toText(row.Synopsis),
		Year:        toIntPtr(row.Year),
		Metadata:    metadata,
		ExpansionOf: row.ExpansionOf,
		CreatedAt:   toTime(row.CreatedAt),
		UpdatedAt:   toTime(row.UpdatedAt),
	}, nil
}

func toDomainEntry(row sqlcgen.LibraryEntry) library.Entry {
	return library.Entry{
		ID:          row.ID,
		MemberID:    row.MemberID,
		WorkID:      row.WorkID,
		Status:      library.Status(row.Status),
		Progress:    int(row.Progress),
		Rating:      toIntPtr(row.Rating),
		IsFavourite: row.IsFavourite,
		Owned:       row.Owned,
		Note:        row.Note,
		StartedAt:   toTimePtr(row.StartedAt),
		FinishedAt:  toTimePtr(row.FinishedAt),
		CreatedAt:   toTime(row.CreatedAt),
		UpdatedAt:   toTime(row.UpdatedAt),
	}
}

func toDomainEntryWithWork(row sqlcgen.ListLibraryEntriesRow) (library.EntryWithWork, error) {
	work, err := toDomainWork(row.Work)
	if err != nil {
		return library.EntryWithWork{}, err
	}

	return library.EntryWithWork{Entry: toDomainEntry(row.LibraryEntry), Work: work}, nil
}
