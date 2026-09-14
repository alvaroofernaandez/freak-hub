package library

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

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

	if err := validateNote(input.Note); err != nil {
		return EntryWithWork{}, err
	}

	work, err := s.existingWork(ctx, input.WorkID)
	if err != nil {
		return EntryWithWork{}, err
	}

	// Creation has no stored rating for an incoming one to match, so the
	// no-op escape hatch below cannot apply here.
	if err := validateRatingChange(input.Rating, nil, input.Status); err != nil {
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
		return EntryWithWork{}, fmt.Errorf("look up the existing entry: %w", err)
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
	switch {
	case errors.Is(err, ErrAlreadyInLibrary):
		// The check above passed and the write still lost: two requests
		// interleaved. The answer is the same 409 either way, because from
		// outside these are the same event.
		return EntryWithWork{}, ErrAlreadyInLibrary
	case err != nil:
		return EntryWithWork{}, fmt.Errorf("add the work to the library: %w", err)
	}

	return EntryWithWork{Entry: entry, Work: work}, nil
}

// GetEntry returns one of the caller's own entries, work inline.
func (s *Service) GetEntry(ctx context.Context, memberID, entryID uuid.UUID) (EntryWithWork, error) {
	entry, err := s.ownedEntry(ctx, memberID, entryID)
	if err != nil {
		return EntryWithWork{}, err
	}

	work, err := s.existingWork(ctx, entry.WorkID)
	if err != nil {
		return EntryWithWork{}, err
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
// for, by sending an explicit null; re-sending the score already stored is a
// no-op and passes in any status, for the same reason re-sending the current
// status is.
func (s *Service) UpdateEntry(
	ctx context.Context, memberID, entryID uuid.UUID, patch EntryPatch,
) (EntryWithWork, error) {
	entry, err := s.ownedEntry(ctx, memberID, entryID)
	if err != nil {
		return EntryWithWork{}, err
	}

	work, err := s.existingWork(ctx, entry.WorkID)
	if err != nil {
		return EntryWithWork{}, err
	}

	// A body with no fields asks for nothing, and writing it anyway would
	// move updated_at — which the activity feed reads as a change.
	if patch.IsEmpty() {
		return EntryWithWork{Entry: entry, Work: work}, nil
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
		if err := validateRatingChange(rating, entry.Rating, resulting); err != nil {
			return EntryWithWork{}, err
		}
	}

	if progress, ok := patch.Progress.Get(); ok {
		if err := ValidateProgress(work, progress); err != nil {
			return EntryWithWork{}, err
		}
	}

	if note, ok := patch.Note.Get(); ok {
		if err := validateNote(note); err != nil {
			return EntryWithWork{}, err
		}
	}

	entry = applyPatch(entry, patch)

	updated, err := s.entries.Update(ctx, entry)
	if err != nil {
		return EntryWithWork{}, fmt.Errorf("update the entry: %w", err)
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
		return fmt.Errorf("remove the entry: %w", err)
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
		return nil, nil, fmt.Errorf("list the library: %w", err)
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
//
// "The same" means the same error value, not merely one errors.Is agrees
// with. A wrapped id on one branch and a bare error on the other is a 404
// either way until a handler logs the error or puts it in a Problem's
// detail — and then the message itself lets somebody walk UUIDs and learn
// which ones are real. So a not-found stays bare, and only a repository that
// actually broke gets wrapped with what was being looked up.
func (s *Service) ownedEntry(ctx context.Context, memberID, entryID uuid.UUID) (Entry, error) {
	if memberID == uuid.Nil {
		return Entry{}, ErrMissingMember
	}

	entry, err := s.entries.ByID(ctx, entryID)

	switch {
	case errors.Is(err, ErrEntryNotFound):
		return Entry{}, ErrEntryNotFound
	case err != nil:
		return Entry{}, fmt.Errorf("look up entry: %w", err)
	}

	if entry.MemberID != memberID {
		return Entry{}, ErrEntryNotFound
	}

	return entry, nil
}

// existingWork resolves a work, keeping the same discipline: a missing one
// answers bare, and only a broken catalogue gets wrapped.
func (s *Service) existingWork(ctx context.Context, workID uuid.UUID) (Work, error) {
	work, err := s.works.ByID(ctx, workID)

	switch {
	case errors.Is(err, ErrWorkNotFound):
		return Work{}, ErrWorkNotFound
	case err != nil:
		return Work{}, fmt.Errorf("look up work: %w", err)
	}

	return work, nil
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

// validateRatingChange is domain rule 2, and every word of it is load-bearing.
//
// The rule is about a rating *arriving in a request*, never about one already
// stored — and about a *change*, not about the field being present. A nil
// incoming rating clears the score and asks for nothing. An incoming rating
// equal to the stored one asks for nothing either, so it passes whatever the
// status: an entry that is in_progress and rated 8 is ordinary, since a score
// survives a rewatch, and refusing it its own representation handed straight
// back would make the state reachable but not re-affirmable.
//
// Anything that would actually move the score needs a status that has an
// opinion behind it. The range check comes first, so a matching stored value
// can never launder an impossible one.
func validateRatingChange(incoming, stored *int, resulting Status) error {
	if incoming == nil {
		return nil
	}

	if *incoming < MinRating || *incoming > MaxRating {
		return ErrInvalidRating
	}

	if resulting.AllowsRating() {
		return nil
	}

	if stored != nil && *stored == *incoming {
		return nil
	}

	return ErrRatingNotAllowed
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

	if err := validateYear(input.Year); err != nil {
		return Work{}, err
	}

	if err := validateSynopsis(input.Synopsis); err != nil {
		return Work{}, err
	}

	if carriesNullCharacter(input.CoverURL) {
		return Work{}, ErrInvalidCoverURL
	}

	if metadataCarriesNullCharacter(input.Metadata) {
		return Work{}, ErrInvalidMetadata
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
		// ErrWorkAlreadyImported cannot reach here: a manual work carries no
		// source id, so there is no key for it to collide on.
		return Work{}, fmt.Errorf("create the manual work: %w", err)
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
	if err := validateQuery(filter.Query); err != nil {
		return nil, nil, err
	}

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

// validateYear holds a release year to the range the contract declares. An
// absent year asks for nothing and passes.
func validateYear(year *int) error {
	if year == nil {
		return nil
	}

	if *year < MinYear || *year > MaxYear {
		return ErrInvalidYear
	}

	return nil
}

// validateNote holds a note to the length the contract declares, counting
// characters rather than bytes. A nil note is an absent or a cleared one and
// passes.
func validateNote(note *string) error {
	if note == nil {
		return nil
	}

	if len([]rune(*note)) > MaxNoteLength || carriesNullCharacter(*note) {
		return ErrInvalidNote
	}

	return nil
}

// validateSynopsis holds a synopsis to the same two rules.
func validateSynopsis(synopsis string) error {
	if len([]rune(synopsis)) > MaxSynopsisLength || carriesNullCharacter(synopsis) {
		return ErrInvalidSynopsis
	}

	return nil
}

// validateQuery holds the free-text search to what a column can hold.
//
// Validity is checked here and nowhere else on purpose. Every other piece of
// client text arrives through encoding/json, which replaces invalid UTF-8
// with U+FFFD before the domain ever sees it — so the same lone surrogate is
// stored as a replacement character in a synopsis and is simply not
// reachable there. A query string is different in kind: raw bytes, through
// net/url, which sanitises nothing and hands the driver exactly what the
// client sent.
func validateQuery(query string) error {
	if len([]rune(query)) > MaxQueryLength {
		return ErrInvalidFilter
	}

	if carriesNullCharacter(query) || !utf8.ValidString(query) {
		return ErrInvalidFilter
	}

	return nil
}

// carriesNullCharacter reports whether text holds U+0000.
//
// It is the one character Postgres will not store in a text column at all —
// 22021, "invalid byte sequence for encoding UTF8: 0x00" — and the one a
// jsonb column refuses as an escape sequence, 22P05. Go is perfectly happy
// to carry it inside a string, so nothing upstream notices: the length is
// fine, the encoding is valid UTF-8, and the request only fails once it has
// reached the database, as a 500 with nothing useful to say.
//
// Modelling it here rather than translating the two SQLSTATEs in the adapter
// is the same choice made for the int4 ceiling, for the same reason: a rule
// about what the client may send belongs where every caller passes, not in
// one adapter that happens to be the storage of the day.
func carriesNullCharacter(text string) bool {
	return strings.ContainsRune(text, '\x00')
}

// metadataCarriesNullCharacter walks the category-specific object looking for
// the same character, at any depth and in keys as well as values.
//
// "At any depth" is the whole point. Metadata is the one part of a work whose
// shape nobody declared, so a check that only read the top level would be a
// check a nested object steps around — and the jsonb column refuses the
// escape wherever it sits.
func metadataCarriesNullCharacter(value any) bool {
	switch typed := value.(type) {
	case string:
		return carriesNullCharacter(typed)
	case Metadata:
		return metadataCarriesNullCharacter(map[string]any(typed))
	case map[string]any:
		for key, nested := range typed {
			if carriesNullCharacter(key) || metadataCarriesNullCharacter(nested) {
				return true
			}
		}

		return false
	case []any:
		for _, nested := range typed {
			if metadataCarriesNullCharacter(nested) {
				return true
			}
		}

		return false
	default:
		// Numbers, booleans and nulls carry no text to refuse.
		return false
	}
}

// normaliseTitle trims the title and holds it to the bounds the contract
// declares, so a title made of spaces can never reach the catalogue.
func normaliseTitle(raw string) (string, error) {
	title := strings.TrimSpace(raw)
	if len(title) < MinTitleLength || len([]rune(title)) > MaxTitleLength {
		return "", ErrInvalidTitle
	}

	if carriesNullCharacter(title) {
		return "", ErrInvalidTitle
	}

	return title, nil
}

// GetWork returns one record of the shared catalogue.
//
// There is no owner check and there is nothing to scope: a Work belongs to
// the whole group by design (domain rule 3), and whether the caller keeps it
// in their own library is a different question, answered by ListLibrary.
func (s *Service) GetWork(ctx context.Context, id uuid.UUID) (Work, error) {
	return s.existingWork(ctx, id)
}
