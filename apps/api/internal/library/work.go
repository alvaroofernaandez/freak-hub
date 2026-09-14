// Package library owns the heart of Freak Hub: the shared catalogue of works
// and each member's own relationship with them.
//
// A Work is the objective record of a thing — a title, a category, a cover —
// and it belongs to the whole group: if two members track the same anime,
// both point at the same Work. An Entry is one member's relationship with one
// Work, and it is where status, progress and rating live. That split is what
// keeps six very different categories in two tables instead of six, and it is
// what will later make matches and recommendations mean something.
//
// This package knows nothing about Postgres, Clerk or HTTP. It declares the
// ports it needs (WorkRepository, EntryRepository) and lets the adapters in
// internal/platform implement them.
package library

import (
	"time"

	"github.com/google/uuid"
)

// Category is what kind of thing a work is. All six are declared because the
// set belongs to the domain, not to the release schedule (docs/domain.md);
// the product only feeds anime for now.
type Category string

// The six categories Freak Hub models.
const (
	CategoryAnime     Category = "anime"
	CategoryManga     Category = "manga"
	CategoryGame      Category = "game"
	CategoryFilm      Category = "film"
	CategoryBoardGame Category = "boardgame"
	CategoryTCG       Category = "tcg"
)

// Valid reports whether c is one of the six declared categories.
func (c Category) Valid() bool {
	switch c {
	case CategoryAnime, CategoryManga, CategoryGame, CategoryFilm, CategoryBoardGame, CategoryTCG:
		return true
	default:
		return false
	}
}

// Source is where a work's record came from (docs/catalogs.md).
type Source string

// The catalogues a work can come from. SourceManual means somebody typed it
// in because no public catalogue lists it.
const (
	SourceAniList  Source = "anilist"
	SourceTMDB     Source = "tmdb"
	SourceIGDB     Source = "igdb"
	SourceBGG      Source = "bgg"
	SourceScryfall Source = "scryfall"
	SourceManual   Source = "manual"
)

// Valid reports whether s is one of the declared sources.
func (s Source) Valid() bool {
	switch s {
	case SourceAniList, SourceTMDB, SourceIGDB, SourceBGG, SourceScryfall, SourceManual:
		return true
	default:
		return false
	}
}

// Title bounds a manual work's title shares with the contract.
const (
	MinTitleLength = 1
	MaxTitleLength = 300
)

// Metadata carries everything specific to one category, kept out of the
// fields that apply to all of them. Anime — the only category the product
// feeds today — uses "episodes", "season" and "status_airing".
//
// The map is deliberately open: closing it now would mean inventing fields
// for board games and TCGs that nobody has used yet.
type Metadata map[string]any

// MetadataKeyEpisodes is the anime episode count, when the catalogue knows
// it. Its absence is meaningful: an anime still airing has no known total,
// and progress on it therefore has no ceiling (domain rule 5).
const MetadataKeyEpisodes = "episodes"

// wholeNumber reads a count out of the open metadata map, and says whether
// it found one at all. That second answer is the whole point of domain rule
// 5: a finished anime with 24 episodes caps progress at 24, while one still
// airing declares no count and therefore caps nothing.
//
// It reads defensively because metadata crosses a JSON boundary, where an
// integer comes back as a float64 and anything at all can come back as a
// string. Nonsense is treated as absence rather than as zero, because a
// ceiling of zero would refuse every episode.
func (m Metadata) wholeNumber(key string) (int, bool) {
	raw, ok := m[key]
	if !ok {
		return 0, false
	}

	switch value := raw.(type) {
	case int:
		return value, value >= 0
	case int32:
		return int(value), value >= 0
	case int64:
		return int(value), value >= 0
	case float64:
		if value < 0 || value != float64(int(value)) {
			return 0, false
		}

		return int(value), true
	default:
		return 0, false
	}
}

// Work is the objective record of a thing, shared by the whole group.
//
// A work that came from an external catalogue is unique by (Source,
// SourceID). A manual one has no SourceID and is therefore not deduplicated:
// two members can legitimately add different things under the same title, and
// what prevents an accidental duplicate is searching before creating.
type Work struct {
	ID       uuid.UUID
	Title    string
	Category Category
	Source   Source
	// SourceID is the work's identifier inside Source's own catalogue. It is
	// empty for a manual work, because there is no external record to point at.
	SourceID string
	CoverURL string
	Synopsis string
	Year     *int
	Metadata Metadata
	// ExpansionOf is the base game a board game expansion expands
	// (ADR-0006). Nil for everything else, which today is everything.
	ExpansionOf *uuid.UUID
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// WorkFilter narrows the shared catalogue. A zero value keeps everything.
type WorkFilter struct {
	// Category keeps only works of that category. Empty means no filter.
	Category Category
	// Query is a free-text search over the title. Empty means no filter.
	Query string
}

// ManualWorkInput is what a member types in when no catalogue lists the work.
//
// Neither Source nor SourceID is accepted: what this creates is manual by
// definition, and letting a caller claim a record came from AniList when
// nobody checked would poison the deduplication the imported works rely on.
type ManualWorkInput struct {
	Title    string
	Category Category
	CoverURL string
	Synopsis string
	Year     *int
	Metadata Metadata
}

// Page bounds every library listing shares (ADR-0011:
// docs/decisions/0011-paginacion-por-cursor.md).
const (
	MinListLimit     = 1
	MaxListLimit     = 100
	DefaultListLimit = 25
)

// Cursor is a row's position in the stable order every library listing uses
// for keyset pagination: created_at descending (newest first), tie-broken by
// id descending (ADR-0011). Works and entries share the shape because they
// share the order; the transport layer is what turns it into the opaque
// string a client carries around.
type Cursor struct {
	CreatedAt time.Time
	ID        uuid.UUID
}
