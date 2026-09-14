package postgres

import (
	"context"
	"fmt"
	"math"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/postgres/sqlcgen"
)

// The constraint names this adapter translates. They are named rather than
// matched by SQLSTATE alone because the code says what kind of thing went
// wrong and the constraint says which thing: two unique violations are two
// different answers to whoever is waiting.
const (
	entryPerMemberAndWork = "library_entries_member_work_idx"
	workPerSource         = "works_source_idx"
	entryWorkForeignKey   = "library_entries_work_id_fkey"
)

// WorkRepository implements library.WorkRepository over Postgres.
type WorkRepository struct {
	queries *sqlcgen.Queries
}

// NewWorkRepository builds the Postgres-backed catalogue repository.
func NewWorkRepository(pool *pgxpool.Pool) *WorkRepository {
	return &WorkRepository{queries: sqlcgen.New(pool)}
}

// Create records a work in the shared catalogue.
//
// A duplicate on works_source_idx is library.ErrWorkAlreadyImported and
// nothing else: that index is partial over source_id IS NOT NULL, so only an
// imported record can raise it, and what it means is that somebody has already
// imported this exact catalogue entry.
//
// A CHECK violation is deliberately NOT translated. works_source_id_matches_source
// fires when the work claims a source but carries no id (or a blank one), and
// works_expansion_of_is_another_work when a work expands itself — which the
// database mints the id for, so it cannot even be reached from here. Neither is
// something a client sent: they describe a Work the domain itself declares
// impossible, which makes them a bug in whatever composed it. Dressing one up
// as a 4xx would tell a member to fix a field they never typed and would hide
// the real fault, so it travels out wrapped, answers 500, and lands in the log
// with the constraint name that names the fix.
//
// works_expansion_of_fkey is not translated either, and that one is a gap
// rather than a decision. A 23503 there means the base game an expansion points
// at is not in the catalogue, which is a 404 about a work the caller named —
// the same shape as the entry case below. It is unreachable today because
// ManualWorkInput carries no ExpansionOf, and it becomes reachable the day the
// board-game expansions of ADR-0006 arrive. Translate it then; do not
// rediscover it as a 500 in production.
func (r *WorkRepository) Create(ctx context.Context, work library.Work) (library.Work, error) {
	year, err := fromIntPtr(work.Year, "year")
	if err != nil {
		return library.Work{}, fmt.Errorf("insert work: %w", err)
	}

	metadata, err := fromMetadata(work.Metadata)
	if err != nil {
		return library.Work{}, fmt.Errorf("insert work: %w", err)
	}

	row, err := r.queries.CreateWork(ctx, sqlcgen.CreateWorkParams{
		Title:       work.Title,
		Category:    sqlcgen.WorkCategory(work.Category),
		Source:      sqlcgen.WorkSource(work.Source),
		SourceID:    fromText(work.SourceID),
		CoverUrl:    fromText(work.CoverURL),
		Synopsis:    fromText(work.Synopsis),
		Year:        year,
		Metadata:    metadata,
		ExpansionOf: work.ExpansionOf,
	})
	if err != nil {
		if isUniqueViolation(err, workPerSource) {
			return library.Work{}, library.ErrWorkAlreadyImported
		}

		return library.Work{}, fmt.Errorf("insert work: %w", err)
	}

	return toDomainWork(row)
}

// ByID returns library.ErrWorkNotFound when no work carries that id.
func (r *WorkRepository) ByID(ctx context.Context, id uuid.UUID) (library.Work, error) {
	row, err := r.queries.WorkByID(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return library.Work{}, library.ErrWorkNotFound
		}

		return library.Work{}, fmt.Errorf("select work by id: %w", err)
	}

	return toDomainWork(row)
}

// BySource resolves an imported work by its catalogue coordinates.
//
// An empty source id is answered without asking the database. A manual work
// stores NULL there, so `source_id = ”` would match nothing anyway — but
// saying so here makes the intent explicit rather than accidental: manual
// works are deliberately not deduplicated and must never be resolvable this way.
func (r *WorkRepository) BySource(
	ctx context.Context, source library.Source, sourceID string,
) (library.Work, error) {
	if sourceID == "" {
		return library.Work{}, library.ErrWorkNotFound
	}

	row, err := r.queries.WorkBySource(ctx, sqlcgen.WorkBySourceParams{
		Source:   sqlcgen.WorkSource(source),
		SourceID: sourceID,
	})
	if err != nil {
		if isNoRows(err) {
			return library.Work{}, library.ErrWorkNotFound
		}

		return library.Work{}, fmt.Errorf("select work by source: %w", err)
	}

	return toDomainWork(row)
}

// Search returns a page of the shared catalogue, newest first (ADR-0011).
//
// The opaque cursor is decoded before it gets here — internal/platform/httpx
// owns that codec, and the port takes the (created_at, id) position it points
// at. So there is no cursor to fail to decode at this layer and no
// invalid-cursor error for it to raise.
func (r *WorkRepository) Search(
	ctx context.Context, filter library.WorkFilter, after *library.Cursor, limit int,
) ([]library.Work, error) {
	pageLimit, err := pageLimitOf(limit, "search works")
	if err != nil {
		return nil, err
	}

	params := sqlcgen.ListWorksParams{PageLimit: pageLimit}
	if filter.Category != "" {
		category := sqlcgen.WorkCategory(filter.Category)
		params.Category = &category
	}

	if filter.Query != "" {
		query := filter.Query
		params.Search = &query
	}

	applyWorkCursor(&params, after)

	rows, err := r.queries.ListWorks(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("select works: %w", err)
	}

	found := make([]library.Work, 0, len(rows))
	for _, row := range rows {
		work, err := toDomainWork(row)
		if err != nil {
			return nil, err
		}

		found = append(found, work)
	}

	return found, nil
}

// EntryRepository implements library.EntryRepository over Postgres.
type EntryRepository struct {
	queries *sqlcgen.Queries
}

// NewEntryRepository builds the Postgres-backed library repository.
func NewEntryRepository(pool *pgxpool.Pool) *EntryRepository {
	return &EntryRepository{queries: sqlcgen.New(pool)}
}

// Create registers a work in a member's library.
//
// Two violations reach here and they mean opposite things. A duplicate on
// library_entries_member_work_idx is domain rule 1 — the member already keeps
// this work — and becomes ErrAlreadyInLibrary, which is the 409 that a double
// click on "añadir" deserves. A foreign key failure on work_id means the
// catalogue has no such work, which is a 404 about the work and not a 500
// about the driver.
func (r *EntryRepository) Create(ctx context.Context, entry library.Entry) (library.Entry, error) {
	params, err := createParamsOf(entry)
	if err != nil {
		return library.Entry{}, err
	}

	row, err := r.queries.CreateLibraryEntry(ctx, params)
	if err != nil {
		return library.Entry{}, translateEntryWrite(err, "insert library entry")
	}

	return toDomainEntry(row), nil
}

// ByID returns library.ErrEntryNotFound when no entry carries that id. It does
// not filter by owner: library.Service.ownedEntry is what turns somebody
// else's entry into the same 404 as a missing one.
func (r *EntryRepository) ByID(ctx context.Context, id uuid.UUID) (library.Entry, error) {
	row, err := r.queries.LibraryEntryByID(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return library.Entry{}, library.ErrEntryNotFound
		}

		return library.Entry{}, fmt.Errorf("select library entry by id: %w", err)
	}

	return toDomainEntry(row), nil
}

// ByMemberAndWork returns library.ErrEntryNotFound when that member has not
// registered that work. It is the read domain rule 1 is checked with, and the
// unique index is what actually holds it.
func (r *EntryRepository) ByMemberAndWork(
	ctx context.Context, memberID, workID uuid.UUID,
) (library.Entry, error) {
	row, err := r.queries.LibraryEntryByMemberAndWork(ctx, sqlcgen.LibraryEntryByMemberAndWorkParams{
		MemberID: memberID,
		WorkID:   workID,
	})
	if err != nil {
		if isNoRows(err) {
			return library.Entry{}, library.ErrEntryNotFound
		}

		return library.Entry{}, fmt.Errorf("select library entry by member and work: %w", err)
	}

	return toDomainEntry(row), nil
}

// List returns a page of one member's library, newest first (ADR-0011), each
// entry carrying its work inline.
//
// One statement, never one per row: ListLibraryEntries joins works and
// sqlc.embed brings both rows back typed, so a page of 25 entries costs one
// round trip instead of twenty-six.
//
// The join is INNER on purpose. work_id is NOT NULL and references works ON
// DELETE RESTRICT, so an entry without its work cannot exist — which makes
// INNER and LEFT return the same rows today, and makes the choice entirely
// about what each would do if that ever stopped being true.
//
// A LEFT JOIN would answer with a zero-valued Work: a library screen rendering
// an untitled card with no cover and no id, which looks like a display bug and
// hides a broken reference for as long as nobody investigates. INNER drops the
// row, so the page carries only entries that are whole.
//
// What INNER does NOT give is a signal that a row was dropped, and it is worth
// being exact about that because the obvious guess is wrong. The LIMIT applies
// after the join, so the engine simply pulls the next row to fill the page: a
// page of six comes back with six rows, identical to what LEFT JOIN would have
// returned, and only the final page of a walk ends up short. Nothing surfaces
// the loss at the page boundary. Measured, not assumed — a reviewer broke a
// reference and walked the whole cursor: nine distinct rows out of nine
// joinable ones, no skips, no zero-valued card.
//
// So the reason to prefer INNER is not detectability. It is that a dropped row
// leaves the page internally consistent, while a zero-valued one corrupts every
// consumer downstream of it — the card, the filter, any code reading Work.ID.
// Both are silent; only one keeps what it does return true.
func (r *EntryRepository) List(
	ctx context.Context, filter library.EntryFilter, after *library.Cursor, limit int,
) ([]library.EntryWithWork, error) {
	pageLimit, err := pageLimitOf(limit, "list library entries")
	if err != nil {
		return nil, err
	}

	params := sqlcgen.ListLibraryEntriesParams{MemberID: filter.MemberID, PageLimit: pageLimit}
	if filter.Status != "" {
		status := sqlcgen.LibraryStatus(filter.Status)
		params.Status = &status
	}

	if filter.Category != "" {
		category := sqlcgen.WorkCategory(filter.Category)
		params.Category = &category
	}

	if after != nil {
		params.AfterCreatedAt = fromTimePtr(&after.CreatedAt)
		id := after.ID
		params.AfterID = &id
	}

	rows, err := r.queries.ListLibraryEntries(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("select library entries: %w", err)
	}

	page := make([]library.EntryWithWork, 0, len(rows))
	for _, row := range rows {
		entry, err := toDomainEntryWithWork(row)
		if err != nil {
			return nil, err
		}

		page = append(page, entry)
	}

	return page, nil
}

// Update writes every mutable column of an entry.
//
// Every column, not the ones that changed: the contract tells an absent
// property ("leave it") from an explicit null ("clear it"), and a
// COALESCE-per-column update collapses both into "leave it", which would make
// clearing a rating, a note or a date impossible. The service merges the patch
// onto the stored entry and hands the whole row down here.
func (r *EntryRepository) Update(ctx context.Context, entry library.Entry) (library.Entry, error) {
	progress, err := fromInt(entry.Progress, "progress")
	if err != nil {
		return library.Entry{}, fmt.Errorf("update library entry: %w", err)
	}

	rating, err := fromIntPtr(entry.Rating, "rating")
	if err != nil {
		return library.Entry{}, fmt.Errorf("update library entry: %w", err)
	}

	row, err := r.queries.UpdateLibraryEntry(ctx, sqlcgen.UpdateLibraryEntryParams{
		ID:          entry.ID,
		MemberID:    entry.MemberID,
		Status:      sqlcgen.LibraryStatus(entry.Status),
		Progress:    progress,
		Rating:      rating,
		IsFavourite: entry.IsFavourite,
		Owned:       entry.Owned,
		Note:        entry.Note,
		StartedAt:   fromTimePtr(entry.StartedAt),
		FinishedAt:  fromTimePtr(entry.FinishedAt),
	})
	if err != nil {
		if isNoRows(err) {
			return library.Entry{}, library.ErrEntryNotFound
		}

		return library.Entry{}, translateEntryWrite(err, "update library entry")
	}

	return toDomainEntry(row), nil
}

// Delete removes one entry. The work it pointed at stays in the catalogue:
// what is deleted is a relationship, never shared history (domain rule 3).
//
// A delete that removed nothing is reported rather than swallowed, so a second
// attempt answers 404 instead of pretending it worked.
//
// Dropping the member guard from the statement is safe today for a reason that
// is narrower than it looks: member_id is immutable — no query in db/queries
// updates it — and UUIDv4 ids are not reused, so the entry ownedEntry resolved
// is still the entry this deletes. The day a "transfer an entry" feature or an
// account merge can move member_id, the check-then-act in
// Service.RemoveFromLibrary becomes a live TOCTOU and the owner has to come
// back into this WHERE.
func (r *EntryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	removed, err := r.queries.DeleteLibraryEntry(ctx, id)
	if err != nil {
		return fmt.Errorf("delete library entry: %w", err)
	}

	if removed == 0 {
		return library.ErrEntryNotFound
	}

	return nil
}

// createParamsOf narrows a domain entry onto the columns it is written to.
func createParamsOf(entry library.Entry) (sqlcgen.CreateLibraryEntryParams, error) {
	progress, err := fromInt(entry.Progress, "progress")
	if err != nil {
		return sqlcgen.CreateLibraryEntryParams{}, fmt.Errorf("insert library entry: %w", err)
	}

	rating, err := fromIntPtr(entry.Rating, "rating")
	if err != nil {
		return sqlcgen.CreateLibraryEntryParams{}, fmt.Errorf("insert library entry: %w", err)
	}

	return sqlcgen.CreateLibraryEntryParams{
		MemberID:    entry.MemberID,
		WorkID:      entry.WorkID,
		Status:      sqlcgen.LibraryStatus(entry.Status),
		Progress:    progress,
		Rating:      rating,
		IsFavourite: entry.IsFavourite,
		Owned:       entry.Owned,
		Note:        entry.Note,
		StartedAt:   fromTimePtr(entry.StartedAt),
		FinishedAt:  fromTimePtr(entry.FinishedAt),
	}, nil
}

// translateEntryWrite turns the two constraint failures a write to
// library_entries can raise into the domain errors that mean the same thing.
func translateEntryWrite(err error, action string) error {
	switch {
	case isUniqueViolation(err, entryPerMemberAndWork):
		return library.ErrAlreadyInLibrary
	case isForeignKeyViolation(err, entryWorkForeignKey):
		return library.ErrWorkNotFound
	default:
		return fmt.Errorf("%s: %w", action, err)
	}
}

// applyWorkCursor puts the decoded keyset position onto the catalogue listing.
func applyWorkCursor(params *sqlcgen.ListWorksParams, after *library.Cursor) {
	if after == nil {
		return
	}

	params.AfterCreatedAt = fromTimePtr(&after.CreatedAt)
	id := after.ID
	params.AfterID = &id
}

// pageLimitOf narrows the page size onto the int4 the LIMIT is. The service
// has already held it to [1, 100] and asks for limit+1 to find out whether
// another page follows (ADR-0011); this only refuses what could not be sent
// at all.
func pageLimitOf(limit int, action string) (int32, error) {
	if limit < 0 || limit > math.MaxInt32 {
		return 0, fmt.Errorf("%s: limit %d out of range", action, limit)
	}

	return int32(limit), nil
}
