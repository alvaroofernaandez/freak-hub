package library

import (
	"context"

	"github.com/google/uuid"
)

// WorkRepository persists the catalogue every member shares.
//
// There is deliberately no Delete: domain rule 3 says a work is never
// removed, not even when nobody keeps it any more, because it is shared
// history. A rule enforced by the absence of a method cannot be broken by
// forgetting to check it.
type WorkRepository interface {
	// Create returns ErrWorkAlreadyImported when an imported work with the
	// same (source, source_id) is already in the catalogue. Manual works
	// carry no source id and are never refused for that reason.
	Create(ctx context.Context, work Work) (Work, error)
	// ByID returns ErrWorkNotFound when no work carries that id.
	ByID(ctx context.Context, id uuid.UUID) (Work, error)
	// BySource resolves an imported work by its catalogue coordinates and
	// returns ErrWorkNotFound when it has not been imported yet.
	BySource(ctx context.Context, source Source, sourceID string) (Work, error)
	// Search returns a page of the catalogue, newest first. after is nil for
	// the first page; otherwise only rows strictly after that position are
	// returned. It returns at most limit rows (ADR-0011).
	Search(ctx context.Context, filter WorkFilter, after *Cursor, limit int) ([]Work, error)
}

// EntryRepository persists each member's own relationship with the works.
//
// Every lookup that can reach somebody else's entry takes the member as well,
// so a forgotten owner check is a compile error rather than a leak.
type EntryRepository interface {
	// Create returns ErrAlreadyInLibrary when that member already keeps that
	// work (domain rule 1). The service checks first, but checking and
	// creating are two steps and two requests can interleave between them,
	// so the storage layer is where the rule is actually held.
	Create(ctx context.Context, entry Entry) (Entry, error)
	// ByID returns ErrEntryNotFound when no entry carries that id. It does
	// not filter by owner: the service is what decides that somebody else's
	// entry answers as missing.
	ByID(ctx context.Context, id uuid.UUID) (Entry, error)
	// ByMemberAndWork returns ErrEntryNotFound when that member has not
	// registered that work. It is what domain rule 1 is checked with.
	ByMemberAndWork(ctx context.Context, memberID, workID uuid.UUID) (Entry, error)
	// List returns a page of one member's library, newest first, each entry
	// carrying its work inline. after is nil for the first page; otherwise
	// only rows strictly after that position are returned. It returns at
	// most limit rows (ADR-0011).
	List(ctx context.Context, filter EntryFilter, after *Cursor, limit int) ([]EntryWithWork, error)
	Update(ctx context.Context, entry Entry) (Entry, error)
	// Delete removes one entry. The work it pointed at stays in the
	// catalogue: what is deleted is a relationship, never shared history
	// (domain rules 3 and 4).
	Delete(ctx context.Context, id uuid.UUID) error
}
