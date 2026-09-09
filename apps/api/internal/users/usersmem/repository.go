// Package usersmem provides an in-memory users.Repository for tests.
package usersmem

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// Repository keeps members in a map. It is safe for concurrent use so table
// tests can run in parallel.
type Repository struct {
	mu       sync.RWMutex
	byClerk  map[string]users.User
	NowFunc  func() time.Time
	NewIDFun func() uuid.UUID
}

// New builds an empty in-memory repository.
func New() *Repository {
	return &Repository{
		byClerk:  make(map[string]users.User),
		NowFunc:  time.Now,
		NewIDFun: uuid.New,
	}
}

// ByClerkID implements users.Repository.
func (r *Repository) ByClerkID(_ context.Context, clerkUserID string) (users.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	user, ok := r.byClerk[clerkUserID]
	if !ok {
		return users.User{}, users.ErrNotFound
	}

	return user, nil
}

// ByID implements users.Repository.
func (r *Repository) ByID(_ context.Context, id uuid.UUID) (users.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, user := range r.byClerk {
		if user.ID == id {
			return user, nil
		}
	}

	return users.User{}, users.ErrNotFound
}

// Upsert implements users.Repository.
func (r *Repository) Upsert(_ context.Context, user users.User) (users.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := r.NowFunc()

	if existing, ok := r.byClerk[user.ClerkUserID]; ok {
		existing.Username = user.Username
		existing.DisplayName = user.DisplayName
		existing.AvatarURL = user.AvatarURL
		existing.Email = user.Email
		existing.UpdatedAt = now
		r.byClerk[user.ClerkUserID] = existing

		return existing, nil
	}

	user.ID = r.NewIDFun()
	user.CreatedAt = now
	user.UpdatedAt = now
	r.byClerk[user.ClerkUserID] = user

	return user, nil
}

// DeleteByClerkID implements users.Repository.
func (r *Repository) DeleteByClerkID(_ context.Context, clerkUserID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.byClerk, clerkUserID)

	return nil
}

// List implements users.Repository. It orders by member-since ascending,
// tie-broken by id, matching the keyset order the Postgres adapter uses
// (ADR-0011).
func (r *Repository) List(_ context.Context, after *users.Cursor, limit int) ([]users.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	all := make([]users.User, 0, len(r.byClerk))
	for _, user := range r.byClerk {
		all = append(all, user)
	}

	sort.Slice(all, func(i, j int) bool {
		return isBeforeInMemberOrder(all[i], all[j])
	})

	start := 0
	if after != nil {
		// all is sorted in the same order isAfterCursor tests for, so the
		// predicate is monotonic and sort.Search finds the first match.
		start = sort.Search(len(all), func(i int) bool {
			return isAfterCursor(all[i], *after)
		})
	}

	end := start + limit
	if end > len(all) {
		end = len(all)
	}

	return append([]users.User{}, all[start:end]...), nil
}

// isBeforeInMemberOrder reports whether a sorts strictly before b in the
// stable member-since order (ADR-0011): created_at ascending, id as tiebreak.
func isBeforeInMemberOrder(a, b users.User) bool {
	if !a.CreatedAt.Equal(b.CreatedAt) {
		return a.CreatedAt.Before(b.CreatedAt)
	}

	return a.ID.String() < b.ID.String()
}

// isAfterCursor reports whether user comes strictly after cursor in that
// same order.
func isAfterCursor(user users.User, cursor users.Cursor) bool {
	if !user.CreatedAt.Equal(cursor.CreatedAt) {
		return user.CreatedAt.After(cursor.CreatedAt)
	}

	return user.ID.String() > cursor.ID.String()
}

// Count reports how many members are stored, for assertions.
func (r *Repository) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.byClerk)
}
