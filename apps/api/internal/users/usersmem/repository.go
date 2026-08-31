// Package usersmem provides an in-memory users.Repository for tests.
package usersmem

import (
	"context"
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

// Count reports how many members are stored, for assertions.
func (r *Repository) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.byClerk)
}
