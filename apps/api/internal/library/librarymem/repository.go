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

// Create implements library.WorkRepository, holding the partial unique index
// the schema will: imported works are unique by (source, source_id), and
// manual works — whose source id is empty by definition — are not
// deduplicated at all.
func (r *WorkRepository) Create(_ context.Context, work library.Work) (library.Work, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.CreateErr != nil {
		return library.Work{}, r.CreateErr
	}

	if work.SourceID != "" {
		for _, item := range r.items {
			if item.Source == work.Source && item.SourceID == work.SourceID {
				return library.Work{}, library.ErrWorkAlreadyImported
			}
		}
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

// EntryRepository stores each member's relationship with the works in a
// slice. It holds the catalogue too, because List resolves the work every
// entry travels with — the stand-in for the JOIN the Postgres adapter does.
type EntryRepository struct {
	mu    sync.RWMutex
	items []library.Entry
	works *WorkRepository
	// NowFunc returns the timestamps Create and Update stamp. Tests pin it
	// to make listing order deterministic instead of depending on
	// wall-clock timing.
	NowFunc func() time.Time
	// CreateErr makes Create fail, so a test can check what the service does
	// when the library is unreachable.
	CreateErr error
}

// NewEntryRepository builds an empty in-memory library over a catalogue.
func NewEntryRepository(works *WorkRepository) *EntryRepository {
	return &EntryRepository{works: works, NowFunc: time.Now}
}

// Seed inserts an entry directly, bypassing Create's side effects, for tests
// that need full control over its fields.
func (r *EntryRepository) Seed(entry library.Entry) library.Entry {
	r.mu.Lock()
	defer r.mu.Unlock()

	if entry.ID == uuid.Nil {
		entry.ID = uuid.New()
	}

	if entry.CreatedAt.IsZero() {
		entry.CreatedAt = r.NowFunc().UTC()
	}

	if entry.UpdatedAt.IsZero() {
		entry.UpdatedAt = entry.CreatedAt
	}

	r.items = append(r.items, entry)

	return entry
}

// Create implements library.EntryRepository, holding the unique index over
// (member_id, work_id) that domain rule 1 rests on.
//
// The service checks with ByMemberAndWork before calling this, but checking
// and creating are two steps: two interleaved requests both pass the check.
// Refusing here is what turns that race into ErrAlreadyInLibrary — a 409 —
// instead of whatever the storage engine would have raised on its own.
func (r *EntryRepository) Create(_ context.Context, entry library.Entry) (library.Entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.CreateErr != nil {
		return library.Entry{}, r.CreateErr
	}

	for _, item := range r.items {
		if item.MemberID == entry.MemberID && item.WorkID == entry.WorkID {
			return library.Entry{}, library.ErrAlreadyInLibrary
		}
	}

	entry.ID = uuid.New()
	entry.CreatedAt = r.NowFunc().UTC()
	entry.UpdatedAt = entry.CreatedAt
	r.items = append(r.items, entry)

	return entry, nil
}

// ByID implements library.EntryRepository.
func (r *EntryRepository) ByID(_ context.Context, id uuid.UUID) (library.Entry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, item := range r.items {
		if item.ID == id {
			return item, nil
		}
	}

	return library.Entry{}, library.ErrEntryNotFound
}

// ByMemberAndWork implements library.EntryRepository. It is the lookup
// domain rule 1 rests on, and it is also what the real unique index over
// (member_id, work_id) will enforce underneath.
func (r *EntryRepository) ByMemberAndWork(
	_ context.Context, memberID, workID uuid.UUID,
) (library.Entry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, item := range r.items {
		if item.MemberID == memberID && item.WorkID == workID {
			return item, nil
		}
	}

	return library.Entry{}, library.ErrEntryNotFound
}

// List implements library.EntryRepository, resolving each entry's work the
// way the Postgres adapter will with a JOIN, and applying the same keyset
// order (ADR-0011).
func (r *EntryRepository) List(
	ctx context.Context, filter library.EntryFilter, after *library.Cursor, limit int,
) ([]library.EntryWithWork, error) {
	r.mu.RLock()
	matching := make([]library.Entry, 0, len(r.items))

	for _, item := range r.items {
		if item.MemberID != filter.MemberID {
			continue
		}

		if filter.Status != "" && item.Status != filter.Status {
			continue
		}

		matching = append(matching, item)
	}
	r.mu.RUnlock()

	joined := make([]library.Entry, 0, len(matching))
	works := make(map[uuid.UUID]library.Work, len(matching))

	for _, item := range matching {
		work, err := r.works.ByID(ctx, item.WorkID)
		if err != nil {
			return nil, err
		}

		if filter.Category != "" && work.Category != filter.Category {
			continue
		}

		works[item.ID] = work
		joined = append(joined, item)
	}

	rows := pageOfEntries(joined, after, limit)

	page := make([]library.EntryWithWork, 0, len(rows))
	for _, row := range rows {
		page = append(page, library.EntryWithWork{Entry: row, Work: works[row.ID]})
	}

	return page, nil
}

// Update implements library.EntryRepository.
func (r *EntryRepository) Update(_ context.Context, entry library.Entry) (library.Entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, item := range r.items {
		if item.ID != entry.ID {
			continue
		}

		entry.CreatedAt = item.CreatedAt
		entry.UpdatedAt = r.NowFunc().UTC()
		r.items[i] = entry

		return entry, nil
	}

	return library.Entry{}, library.ErrEntryNotFound
}

// Delete implements library.EntryRepository. It removes the relationship and
// nothing else: the work stays in the catalogue, which is domain rule 3 seen
// from the other side.
func (r *EntryRepository) Delete(_ context.Context, id uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, item := range r.items {
		if item.ID == id {
			r.items = append(r.items[:i], r.items[i+1:]...)

			return nil
		}
	}

	return library.ErrEntryNotFound
}

// pageOfEntries is the keyset walk the library listing uses, identical in
// order to the catalogue's (ADR-0011). Doing it the same way twice is what
// keeps the two doubles from drifting apart in a way the Postgres adapter
// never would.
func pageOfEntries(items []library.Entry, after *library.Cursor, limit int) []library.Entry {
	sorted := make([]library.Entry, len(items))
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
