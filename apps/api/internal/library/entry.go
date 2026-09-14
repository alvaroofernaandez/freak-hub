package library

import (
	"time"

	"github.com/google/uuid"
)

// Status is where a member stands with a work.
//
// The wishlist is not a separate list: it is this type's StatusWishlist,
// which is what lets an entry travel from wanted to finished without changing
// collection or losing its history (docs/domain.md).
type Status string

// The six points of an entry's lifecycle.
const (
	StatusWishlist   Status = "wishlist"
	StatusPending    Status = "pending"
	StatusInProgress Status = "in_progress"
	StatusCompleted  Status = "completed"
	StatusDropped    Status = "dropped"
	StatusOnHold     Status = "on_hold"
)

// Valid reports whether s is one of the six declared statuses.
func (s Status) Valid() bool {
	switch s {
	case StatusWishlist, StatusPending, StatusInProgress, StatusCompleted, StatusDropped, StatusOnHold:
		return true
	default:
		return false
	}
}

// AllowsRating is domain rule 2: a rating only means something once there is
// an opinion, which is to say once the work is finished or abandoned.
//
// It answers about a rating *arriving in a request*, never about one already
// stored. A score survives a later status change: a rewatch does not erase it
// (see Service.UpdateEntry).
func (s Status) AllowsRating() bool {
	return s == StatusCompleted || s == StatusDropped
}

// Rating bounds a score shares with the contract.
const (
	MinRating = 1
	MaxRating = 10
)

// transitions is the state machine docs/domain.md draws, transcribed arrow by
// arrow. Everything absent from it is refused, which is what keeps that
// diagram a rule instead of decoration.
//
// The two arrows leaving the start node are deliberately missing: creating an
// entry is the entry point into the lifecycle, not a transition, and the
// contract accepts all six statuses there. Registering an anime you finished
// years ago is an ordinary thing to do, and forcing it through pending plus a
// PATCH would be theatre.
//
// The arrows into the end node are missing for the same kind of reason:
// leaving the library is a deletion, and the contract puts no status
// condition on it.
var transitions = map[Status][]Status{
	StatusWishlist:   {StatusPending},
	StatusPending:    {StatusInProgress},
	StatusInProgress: {StatusOnHold, StatusCompleted, StatusDropped},
	StatusOnHold:     {StatusInProgress},
	StatusCompleted:  {StatusInProgress},
	StatusDropped:    {},
}

// CanTransition reports whether the state machine in docs/domain.md draws an
// arrow from one status to another.
//
// Staying put counts as legitimate: a client that resends the status an entry
// already holds is asking for nothing, and answering 422 to a no-op would
// punish the perfectly ordinary habit of PATCHing back the whole object.
func CanTransition(from, to Status) bool {
	if !from.Valid() || !to.Valid() {
		return false
	}

	if from == to {
		return true
	}

	for _, allowed := range transitions[from] {
		if allowed == to {
			return true
		}
	}

	return false
}

// Entry is one member's relationship with one work — what turns a shared
// catalogue into *your* library. A member holds at most one per work
// (domain rule 1).
type Entry struct {
	ID       uuid.UUID
	MemberID uuid.UUID
	WorkID   uuid.UUID
	Status   Status
	// Progress is how far along the member is, in the unit the work's
	// category defines: episodes for anime. Zero means not started.
	Progress int
	// Rating is a score from 1 to 10, nil when unrated.
	Rating *int
	// IsFavourite is affection, not score. A favourite rated 6 is a
	// perfectly normal thing and the two never imply each other.
	IsFavourite bool
	// Owned records whether the member holds a physical copy.
	Owned bool
	// Note is public to the whole group, with no per-entry privacy setting
	// (ADR-0005). Nil when there is no note.
	Note       *string
	StartedAt  *time.Time
	FinishedAt *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// EntryWithWork is an entry alongside the work it points at. It is what the
// library listing answers with: the whole work travels inline rather than a
// bare id, so a library screen renders titles and covers straight from the
// page it already fetched instead of firing one request per row.
type EntryWithWork struct {
	Entry
	Work Work
}

// EntryFilter narrows a member's library. A zero value keeps everything.
type EntryFilter struct {
	// MemberID is not optional: a listing only ever walks the caller's own
	// library, and making the owner part of the filter is what stops a
	// forgotten WHERE from leaking somebody else's shelf.
	MemberID uuid.UUID
	// Status keeps only entries in that status. Empty means no filter.
	Status Status
	// Category keeps only entries whose work belongs to that category.
	// Empty means no filter.
	Category Category
}

// Total is domain rule 5's other half: how many units a work has, and
// whether that total is known at all.
//
// The unit depends on the category, which is exactly why the domain decides
// this and the database cannot. Today only anime declares its total, through
// metadata.episodes; a category whose unit has not been built yet caps
// nothing, because inventing a ceiling for it would be inventing the unit
// too.
//
// A count of zero reads as unknown rather than as a ceiling of zero. Real
// catalogues publish 0 for a run that has not started, and taking that
// literally traps the entry: once the series begins airing, every progress
// above 0 is refused and the member has no way out. "There exist zero
// episodes" is not a state any watchable work is in — the honest reading is
// that nobody has said yet.
func (w Work) Total() (int, bool) {
	switch w.Category {
	case CategoryAnime:
		episodes, declared := w.Metadata.wholeNumber(MetadataKeyEpisodes)
		if !declared || episodes == 0 {
			return 0, false
		}

		return episodes, true
	case CategoryManga, CategoryGame, CategoryFilm, CategoryBoardGame, CategoryTCG:
		// Their units — chapters, hours, plays — arrive with the categories
		// themselves. Until then nothing is capped, which is why a film
		// accepts a progress of a million today: not an oversight, a
		// category whose unit has not been designed. See docs/domain.md.
		return 0, false
	default:
		return 0, false
	}
}

// ValidateProgress is domain rule 5: progress is never negative, and it never
// passes the work's total when that total is known.
//
// The "when known" is the whole nuance. An anime still airing has no episode
// count in its metadata, and refusing episode 13 of a series that has aired
// 13 would be the domain inventing a fact the catalogue never gave it.
func ValidateProgress(work Work, progress int) error {
	if progress < 0 {
		return ErrInvalidProgress
	}

	total, known := work.Total()
	if known && progress > total {
		return ErrInvalidProgress
	}

	return nil
}

// AddToLibraryInput is what a member sends to register a work.
//
// Status is required rather than defaulted, and any of the six is accepted:
// wanting something, already owning it and having finished it years ago are
// all equally normal ways to start, so there is nothing sensible to guess.
type AddToLibraryInput struct {
	WorkID      uuid.UUID
	Status      Status
	Progress    int
	Rating      *int
	IsFavourite bool
	Owned       bool
	Note        *string
	StartedAt   *time.Time
	FinishedAt  *time.Time
}

// Field carries a value that may be absent from a patch. Absent and nil are
// different things and the contract leans on the difference: an absent
// property leaves the stored value alone, while an explicit null clears it.
// Without this distinction there is no way to remove a rating, a note or a
// date at all.
type Field[T any] struct {
	present bool
	value   T
}

// Set marks a field as present in the patch, carrying that value. A pointer
// type set to nil is the explicit null: Set[*int](nil) clears a rating.
func Set[T any](value T) Field[T] {
	return Field[T]{present: true, value: value}
}

// Get returns the value and whether the patch carried the field at all.
func (f Field[T]) Get() (T, bool) {
	return f.value, f.present
}

// EntryPatch is a partial update: only the fields present are touched.
//
// WorkID is absent by design — an entry never changes the work it points at.
type EntryPatch struct {
	Status      Field[Status]
	Progress    Field[int]
	Rating      Field[*int]
	IsFavourite Field[bool]
	Owned       Field[bool]
	Note        Field[*string]
	StartedAt   Field[*time.Time]
	FinishedAt  Field[*time.Time]
}

// IsEmpty reports whether the patch carries no field at all.
//
// It is not a tidiness check. A body with no properties changes nothing and
// answers 200 with the entry untouched, and "untouched" has to include
// updated_at: docs/domain.md resolves the activity feed by reading changes
// to LibraryEntry rather than from an events table, so stamping a timestamp
// nobody asked to move would announce to the whole group that somebody
// updated something when nobody did.
//
// A patch whose values merely happen to match what is stored is not empty. A
// client that sent a field did ask for a write, and pretending otherwise
// would make the answer depend on data the client cannot see.
func (p EntryPatch) IsEmpty() bool {
	present := []bool{
		p.Status.present,
		p.Progress.present,
		p.Rating.present,
		p.IsFavourite.present,
		p.Owned.present,
		p.Note.present,
		p.StartedAt.present,
		p.FinishedAt.present,
	}

	for _, carried := range present {
		if carried {
			return false
		}
	}

	return true
}
