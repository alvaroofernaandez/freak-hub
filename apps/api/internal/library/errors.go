package library

import "errors"

// Domain errors. Transport layers map these onto the status codes and the
// error codes the contract declares (packages/contracts/openapi.yaml), one to
// one:
//
//	ErrAlreadyInLibrary  → 409 already_in_library
//	ErrWorkNotFound      → 404 work_not_found
//	ErrEntryNotFound     → 404 library_entry_not_found
//	ErrRatingNotAllowed  → 422 rating_not_allowed
//	ErrInvalidProgress   → 422 invalid_progress
//	ErrInvalidTransition → 422 invalid_transition
//	ErrInvalidTitle      → 400 invalid_payload
//	ErrInvalidCategory   → 400 invalid_payload
//	ErrInvalidStatus     → 400 invalid_payload
//	ErrInvalidRating     → 400 invalid_payload
//	ErrInvalidFilter     → 400 invalid_filter
//	ErrInvalidLimit      → 400 invalid_limit
//	ErrMissingMember     → 401 unauthorized
//
// Nothing else escapes this package unwrapped: a repository failure travels
// out wrapped with %w, so a caller can still tell it apart with errors.Is
// while the transport layer answers 500.
var (
	// ErrAlreadyInLibrary is domain rule 1: a member holds at most one entry
	// per work. Watching something again is progress, not a second row.
	ErrAlreadyInLibrary = errors.New("this work is already in the member's library")
	// ErrWorkNotFound means no work carries that id.
	ErrWorkNotFound = errors.New("work not found")
	// ErrEntryNotFound means the caller has no entry with that id. Somebody
	// else's entry answers with this too: whose library holds what is nobody
	// else's business, so the answer is 404 and never 403.
	ErrEntryNotFound = errors.New("library entry not found")
	// ErrRatingNotAllowed is domain rule 2: a rating arriving in a request is
	// only legitimate when the resulting status is completed or dropped.
	ErrRatingNotAllowed = errors.New("a rating is only allowed on a completed or dropped entry")
	// ErrInvalidProgress is domain rule 5: progress is never negative, and it
	// never passes the work's total when that total is known.
	ErrInvalidProgress = errors.New("progress does not fit the work")
	// ErrInvalidTransition means the state machine in docs/domain.md does not
	// allow that move.
	ErrInvalidTransition = errors.New("that status transition is not allowed")
	// ErrInvalidTitle means the title is empty or longer than MaxTitleLength.
	ErrInvalidTitle = errors.New("title must be between 1 and 300 characters")
	// ErrInvalidCategory means the payload names a category that does not exist.
	ErrInvalidCategory = errors.New("category is not one of the declared values")
	// ErrInvalidStatus means the payload names a status that does not exist.
	ErrInvalidStatus = errors.New("status is not one of the declared values")
	// ErrInvalidRating means the rating falls outside 1..10.
	ErrInvalidRating = errors.New("rating must be between 1 and 10")
	// ErrInvalidFilter means a listing filter names a value that does not exist.
	// A filter is never ignored silently: answering the unfiltered list would
	// look like success and quietly show entries the caller asked to hide.
	ErrInvalidFilter = errors.New("filter is not one of the declared values")
	// ErrInvalidLimit is returned when limit falls outside
	// [MinListLimit, MaxListLimit] (ADR-0011).
	ErrInvalidLimit = errors.New("limit must be between 1 and 100")
	// ErrMissingMember means no member was identified for a call that acts on
	// somebody's own library.
	ErrMissingMember = errors.New("member is required")
)
