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
func (w Work) Total() (int, bool) {
	switch w.Category {
	case CategoryAnime:
		return w.Metadata.wholeNumber(MetadataKeyEpisodes)
	case CategoryManga, CategoryGame, CategoryFilm, CategoryBoardGame, CategoryTCG:
		// Their units — chapters, hours, plays — arrive with the categories
		// themselves. Until then nothing is capped.
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
