package library

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// ServiceDeps are the collaborators the use cases need.
type ServiceDeps struct {
	Works   WorkRepository
	Entries EntryRepository
}

// Service holds the library use cases and the domain rules they enforce.
type Service struct {
	works   WorkRepository
	entries EntryRepository
}

// NewService builds the library use cases from its collaborators.
func NewService(deps ServiceDeps) *Service {
	return &Service{works: deps.Works, entries: deps.Entries}
}

// AddToLibrary registers a work in a member's library.
//
// All six statuses are accepted here. Creating an entry is the entry point
// into the lifecycle, not a transition, so the state machine does not
// constrain it: what it constrains is the PATCH that comes later.
//
// The checks run before the write and in the order that keeps the answer
// honest: the work has to exist before there is anything to refuse a rating
// about, and domain rule 1 is checked last because it is the only one that
// depends on what is already stored.
func (s *Service) AddToLibrary(
	ctx context.Context, memberID uuid.UUID, input AddToLibraryInput,
) (EntryWithWork, error) {
	if memberID == uuid.Nil {
		return EntryWithWork{}, ErrMissingMember
	}

	if !input.Status.Valid() {
		return EntryWithWork{}, ErrInvalidStatus
	}

	work, err := s.works.ByID(ctx, input.WorkID)
	if err != nil {
		return EntryWithWork{}, fmt.Errorf("look up work %s: %w", input.WorkID, err)
	}

	if err := validateIncomingRating(input.Rating, input.Status); err != nil {
		return EntryWithWork{}, err
	}

	if err := ValidateProgress(work, input.Progress); err != nil {
		return EntryWithWork{}, err
	}

	switch _, err := s.entries.ByMemberAndWork(ctx, memberID, input.WorkID); {
	case err == nil:
		// Domain rule 1: watching something again is progress on the entry
		// that already exists, never a second row.
		return EntryWithWork{}, ErrAlreadyInLibrary
	case errors.Is(err, ErrEntryNotFound):
		// Nothing registered yet: carry on.
	default:
		return EntryWithWork{}, fmt.Errorf("look up entry for work %s: %w", input.WorkID, err)
	}

	entry, err := s.entries.Create(ctx, Entry{
		MemberID:    memberID,
		WorkID:      input.WorkID,
		Status:      input.Status,
		Progress:    input.Progress,
		Rating:      input.Rating,
		IsFavourite: input.IsFavourite,
		Owned:       input.Owned,
		Note:        input.Note,
		StartedAt:   input.StartedAt,
		FinishedAt:  input.FinishedAt,
	})
	if err != nil {
		return EntryWithWork{}, fmt.Errorf("add work %s to the library of %s: %w", input.WorkID, memberID, err)
	}

	return EntryWithWork{Entry: entry, Work: work}, nil
}

// GetEntry returns one of the caller's own entries, work inline.
func (s *Service) GetEntry(ctx context.Context, memberID, entryID uuid.UUID) (EntryWithWork, error) {
	entry, err := s.ownedEntry(ctx, memberID, entryID)
	if err != nil {
		return EntryWithWork{}, err
	}

	work, err := s.works.ByID(ctx, entry.WorkID)
	if err != nil {
		return EntryWithWork{}, fmt.Errorf("look up work %s: %w", entry.WorkID, err)
	}

	return EntryWithWork{Entry: entry, Work: work}, nil
}

// UpdateEntry applies a partial update to one of the caller's own entries.
//
// A status here is a transition and is checked against the state machine,
// unlike creation, which is the entry point and accepts all six.
//
// The rating rule is checked against the status the entry ends up in, not the
// one it came from, so the score that arrives together with the completion is
// the ordinary case and passes. A rating already stored is never touched by a
// status change: completed → in_progress is a rewatch, there is no rating
// history to restore from, and erasing the score to keep the entry "clean"
// would be silent data loss. Clearing a rating is something a caller asks
// for, by sending an explicit null.
func (s *Service) UpdateEntry(
	ctx context.Context, memberID, entryID uuid.UUID, patch EntryPatch,
) (EntryWithWork, error) {
	entry, err := s.ownedEntry(ctx, memberID, entryID)
	if err != nil {
		return EntryWithWork{}, err
	}

	work, err := s.works.ByID(ctx, entry.WorkID)
	if err != nil {
		return EntryWithWork{}, fmt.Errorf("look up work %s: %w", entry.WorkID, err)
	}

	resulting := entry.Status

	if status, ok := patch.Status.Get(); ok {
		if !status.Valid() {
			return EntryWithWork{}, ErrInvalidStatus
		}

		if !CanTransition(entry.Status, status) {
			return EntryWithWork{}, ErrInvalidTransition
		}

		resulting = status
	}

	if rating, ok := patch.Rating.Get(); ok {
		if err := validateIncomingRating(rating, resulting); err != nil {
			return EntryWithWork{}, err
		}
	}

	if progress, ok := patch.Progress.Get(); ok {
		if err := ValidateProgress(work, progress); err != nil {
			return EntryWithWork{}, err
		}
	}

	entry = applyPatch(entry, patch)

	updated, err := s.entries.Update(ctx, entry)
	if err != nil {
		return EntryWithWork{}, fmt.Errorf("update entry %s: %w", entryID, err)
	}

	return EntryWithWork{Entry: updated, Work: work}, nil
}

// RemoveFromLibrary takes a work out of the caller's own library.
//
// Only the owner can do it, and somebody else's entry answers exactly like a
// missing one. It is allowed from any status: the ends of the state diagram
// are where a life cycle finishes, not a condition on deleting. What leaves
// is the relationship — the work stays in the shared catalogue, which is
// domain rule 3.
func (s *Service) RemoveFromLibrary(ctx context.Context, memberID, entryID uuid.UUID) error {
	if _, err := s.ownedEntry(ctx, memberID, entryID); err != nil {
		return err
	}

	if err := s.entries.Delete(ctx, entryID); err != nil {
		return fmt.Errorf("remove entry %s: %w", entryID, err)
	}

	return nil
}

// ListLibrary returns a page of the caller's own library, newest first
// (ADR-0011), each entry carrying its work inline, and the cursor for the
// next page or nil when this was the last one.
//
// There is no separate wishlist listing because the wishlist is not a
// separate thing: it is Status=wishlist through this same filter.
//
// The owner is overwritten rather than read from the filter. A caller does
// not get to choose whose shelf this walks, and making that impossible here
// is worth more than trusting every future handler to remember.
func (s *Service) ListLibrary(
	ctx context.Context, memberID uuid.UUID, filter EntryFilter, after *Cursor, limit int,
) ([]EntryWithWork, *Cursor, error) {
	if memberID == uuid.Nil {
		return nil, nil, ErrMissingMember
	}

	if limit < MinListLimit || limit > MaxListLimit {
		return nil, nil, ErrInvalidLimit
	}

	if filter.Status != "" && !filter.Status.Valid() {
		return nil, nil, ErrInvalidFilter
	}

	if filter.Category != "" && !filter.Category.Valid() {
		return nil, nil, ErrInvalidFilter
	}

	filter.MemberID = memberID

	// Ask for one extra row: its presence, not a COUNT(*), is what tells us
	// whether another page follows (ADR-0011).
	rows, err := s.entries.List(ctx, filter, after, limit+1)
	if err != nil {
		return nil, nil, fmt.Errorf("list the library of %s: %w", memberID, err)
	}

	if len(rows) <= limit {
		return rows, nil, nil
	}

	rows = rows[:limit]
	last := rows[len(rows)-1]

	return rows, &Cursor{CreatedAt: last.CreatedAt, ID: last.ID}, nil
}

// ownedEntry resolves an entry the caller owns.
//
// An entry that belongs to somebody else answers with ErrEntryNotFound, the
// same as one that does not exist: whose library holds what is nobody else's
// business, and a 403 would confirm the entry is real. That is why the check
// lives here, in the one place every use case has to pass through.
func (s *Service) ownedEntry(ctx context.Context, memberID, entryID uuid.UUID) (Entry, error) {
	if memberID == uuid.Nil {
		return Entry{}, ErrMissingMember
	}

	entry, err := s.entries.ByID(ctx, entryID)
	if err != nil {
		return Entry{}, fmt.Errorf("look up entry %s: %w", entryID, err)
	}

	if entry.MemberID != memberID {
		return Entry{}, ErrEntryNotFound
	}

	return entry, nil
}

// applyPatch copies the fields the patch carries onto the entry, leaving the
// absent ones alone.
func applyPatch(entry Entry, patch EntryPatch) Entry {
	if status, ok := patch.Status.Get(); ok {
		entry.Status = status
	}

	if progress, ok := patch.Progress.Get(); ok {
		entry.Progress = progress
	}

	if rating, ok := patch.Rating.Get(); ok {
		entry.Rating = rating
	}

	if favourite, ok := patch.IsFavourite.Get(); ok {
		entry.IsFavourite = favourite
	}

	if owned, ok := patch.Owned.Get(); ok {
		entry.Owned = owned
	}

	if note, ok := patch.Note.Get(); ok {
		entry.Note = note
	}

	if startedAt, ok := patch.StartedAt.Get(); ok {
		entry.StartedAt = startedAt
	}

	if finishedAt, ok := patch.FinishedAt.Get(); ok {
		entry.FinishedAt = finishedAt
	}

	return entry
}

// validateIncomingRating is domain rule 2, and the "incoming" is the whole of
// it: the rule applies to a rating arriving in a request, never to one
// already stored. A nil rating asks for nothing and is always fine.
func validateIncomingRating(rating *int, resulting Status) error {
	if rating == nil {
		return nil
	}

	if *rating < MinRating || *rating > MaxRating {
		return ErrInvalidRating
	}

	if !resulting.AllowsRating() {
		return ErrRatingNotAllowed
	}

	return nil
}

// CreateManualWork records a work no public catalogue lists.
//
// Source is stamped rather than accepted: what this creates is manual by
// definition, and letting a caller claim the record came from AniList when
// nobody checked would poison the (source, source_id) uniqueness that the
// imported works rely on to be shared. For the same reason SourceID stays
// empty — there is no external record to point at — which is also why manual
// works are not deduplicated: two members can legitimately add different
// things under the same title, and the defence against an accidental
// duplicate is searching before creating, not a unique index over nothing.
func (s *Service) CreateManualWork(ctx context.Context, input ManualWorkInput) (Work, error) {
	title, err := normaliseTitle(input.Title)
	if err != nil {
		return Work{}, err
	}

	if !input.Category.Valid() {
		return Work{}, ErrInvalidCategory
	}

	work, err := s.works.Create(ctx, Work{
		Title:    title,
		Category: input.Category,
		Source:   SourceManual,
		SourceID: "",
		CoverURL: input.CoverURL,
		Synopsis: input.Synopsis,
		Year:     input.Year,
		Metadata: input.Metadata,
	})
	if err != nil {
		return Work{}, fmt.Errorf("create manual work %q: %w", title, err)
	}

	return work, nil
}

// SearchWorks returns a page of the shared catalogue, newest first
// (ADR-0011), and the cursor for the next page, or nil when this was the last
// one.
//
// An unknown category is rejected instead of ignored: answering the
// unfiltered list would look like success while quietly showing rows the
// caller asked to hide.
func (s *Service) SearchWorks(
	ctx context.Context, filter WorkFilter, after *Cursor, limit int,
) ([]Work, *Cursor, error) {
	if limit < MinListLimit || limit > MaxListLimit {
		return nil, nil, ErrInvalidLimit
	}

	if filter.Category != "" && !filter.Category.Valid() {
		return nil, nil, ErrInvalidFilter
	}

	filter.Query = strings.TrimSpace(filter.Query)

	// Ask for one extra row: its presence, not a COUNT(*), is what tells us
	// whether another page follows (ADR-0011).
	rows, err := s.works.Search(ctx, filter, after, limit+1)
	if err != nil {
		return nil, nil, fmt.Errorf("search works: %w", err)
	}

	if len(rows) <= limit {
		return rows, nil, nil
	}

	rows = rows[:limit]
	last := rows[len(rows)-1]

	return rows, &Cursor{CreatedAt: last.CreatedAt, ID: last.ID}, nil
}

// normaliseTitle trims the title and holds it to the bounds the contract
// declares, so a title made of spaces can never reach the catalogue.
func normaliseTitle(raw string) (string, error) {
	title := strings.TrimSpace(raw)
	if len(title) < MinTitleLength || len([]rune(title)) > MaxTitleLength {
		return "", ErrInvalidTitle
	}

	return title, nil
}
