// Package librarymem provides in-memory doubles for the library ports, so the
// five domain rules can be exercised without Postgres, Docker or a network.
package librarymem

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library"
)

// WorkRepository stores the shared catalogue in a slice.
//
// It has no Delete, exactly like the port it implements: domain rule 3 says a
// work is never removed.
type WorkRepository struct {
	mu    sync.RWMutex
	items []library.Work
	// NowFunc returns the creation timestamp Create uses. Tests pin it to
	// make listing order deterministic instead of depending on wall-clock
	// timing.
	NowFunc func() time.Time
	// CreateErr makes Create fail, so a test can check what the service does
	// when the catalogue is unreachable.
	CreateErr error
}

// NewWorkRepository builds an empty in-memory catalogue.
func NewWorkRepository() *WorkRepository {
	return &WorkRepository{NowFunc: time.Now}
}

// Seed inserts a work directly, bypassing Create's side effects, for tests
// that need full control over its fields.
func (r *WorkRepository) Seed(work library.Work) library.Work {
	r.mu.Lock()
	defer r.mu.Unlock()

	if work.ID == uuid.Nil {
		work.ID = uuid.New()
	}

	if work.CreatedAt.IsZero() {
		work.CreatedAt = r.NowFunc().UTC()
	}

	if work.UpdatedAt.IsZero() {
		work.UpdatedAt = work.CreatedAt
	}

	r.items = append(r.items, work)

	return work
}

// Create implements library.WorkRepository.
func (r *WorkRepository) Create(_ context.Context, work library.Work) (library.Work, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.CreateErr != nil {
		return library.Work{}, r.CreateErr
	}

	work.ID = uuid.New()
	work.CreatedAt = r.NowFunc().UTC()
	work.UpdatedAt = work.CreatedAt
	r.items = append(r.items, work)

	return work, nil
}

// ByID implements library.WorkRepository.
func (r *WorkRepository) ByID(_ context.Context, id uuid.UUID) (library.Work, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, item := range r.items {
		if item.ID == id {
			return item, nil
		}
	}

	return library.Work{}, library.ErrWorkNotFound
}

// BySource implements library.WorkRepository. A manual work is never
// resolved this way: its source id is empty by definition, so two manual
// works would collide on a key that means nothing.
func (r *WorkRepository) BySource(
	_ context.Context, source library.Source, sourceID string,
) (library.Work, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if sourceID == "" {
		return library.Work{}, library.ErrWorkNotFound
	}

	for _, item := range r.items {
		if item.Source == source && item.SourceID == sourceID {
			return item, nil
		}
	}

	return library.Work{}, library.ErrWorkNotFound
}

// Search implements library.WorkRepository, applying the same keyset order
// the Postgres adapter will (ADR-0011) and matching titles the way the
// contract promises: case- and accent-insensitive.
func (r *WorkRepository) Search(
	_ context.Context, filter library.WorkFilter, after *library.Cursor, limit int,
) ([]library.Work, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	matching := make([]library.Work, 0, len(r.items))

	for _, item := range r.items {
		if filter.Category != "" && item.Category != filter.Category {
			continue
		}

		if filter.Query != "" && !strings.Contains(fold(item.Title), fold(filter.Query)) {
			continue
		}

		matching = append(matching, item)
	}

	return pageOfWorks(matching, after, limit), nil
}

// accents maps the Latin letters a title is likely to carry onto their bare
// form, so "Kimetsu no Yaiba" and "kimetsú no yaiba" find each other. The
// Postgres adapter gets this from unaccent; the double does it by hand
// rather than pretend the difference does not exist.
var accents = strings.NewReplacer(
	"á", "a", "à", "a", "ä", "a", "â", "a", "ã", "a",
	"é", "e", "è", "e", "ë", "e", "ê", "e",
	"í", "i", "ì", "i", "ï", "i", "î", "i",
	"ó", "o", "ò", "o", "ö", "o", "ô", "o", "õ", "o",
	"ú", "u", "ù", "u", "ü", "u", "û", "u",
	"ñ", "n", "ç", "c",
)

func fold(value string) string {
	return accents.Replace(strings.ToLower(value))
}

// pageOfWorks is the keyset walk the catalogue listing uses: sort into the
// stable order ADR-0011 fixes, skip everything up to and including after, and
// hand back at most limit rows.
func pageOfWorks(items []library.Work, after *library.Cursor, limit int) []library.Work {
	sorted := make([]library.Work, len(items))
	copy(sorted, items)
	sort.Slice(sorted, func(i, j int) bool {
		return isBeforeInListOrder(
			library.Cursor{CreatedAt: sorted[i].CreatedAt, ID: sorted[i].ID},
			library.Cursor{CreatedAt: sorted[j].CreatedAt, ID: sorted[j].ID},
		)
	})

	start := 0
	if after != nil {
		start = sort.Search(len(sorted), func(i int) bool {
			return isAfterCursor(
				library.Cursor{CreatedAt: sorted[i].CreatedAt, ID: sorted[i].ID}, *after,
			)
		})
	}

	end := start + limit
	if end > len(sorted) {
		end = len(sorted)
	}

	if end < start {
		end = start
	}

	return sorted[start:end]
}

// isBeforeInListOrder reports whether a sorts strictly before b in the stable
// listing order (ADR-0011): created_at descending, id as tiebreak.
func isBeforeInListOrder(a, b library.Cursor) bool {
	if !a.CreatedAt.Equal(b.CreatedAt) {
		return a.CreatedAt.After(b.CreatedAt)
	}

	return a.ID.String() > b.ID.String()
}

// isAfterCursor reports whether position comes strictly after cursor in that
// same order.
func isAfterCursor(position, cursor library.Cursor) bool {
	if !position.CreatedAt.Equal(cursor.CreatedAt) {
		return position.CreatedAt.Before(cursor.CreatedAt)
	}

	return position.ID.String() < cursor.ID.String()
}
