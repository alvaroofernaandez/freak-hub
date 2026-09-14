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
