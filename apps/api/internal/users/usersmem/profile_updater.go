package usersmem

import (
	"context"
	"sync"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// ProfileUpdater is a configurable fake of users.ProfileUpdater. Router
// tests inject it so PATCH /v1/me can be exercised end to end — success and
// the "username already taken" conflict — without ever calling Clerk.
type ProfileUpdater struct {
	mu sync.Mutex

	// Profile is what UpdateProfile returns on success.
	Profile users.ClerkProfile
	// Err, when set, is what UpdateProfile returns instead of Profile.
	Err error
	// LastUpdate records the update the last call was asked to apply.
	LastUpdate *users.ProfileUpdate
}

// NewProfileUpdater builds a fake that succeeds by default.
func NewProfileUpdater() *ProfileUpdater {
	return &ProfileUpdater{}
}

// UpdateProfile implements users.ProfileUpdater.
func (f *ProfileUpdater) UpdateProfile(_ context.Context, _ string, update users.ProfileUpdate) (users.ClerkProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.LastUpdate = &update

	if f.Err != nil {
		return users.ClerkProfile{}, f.Err
	}

	return f.Profile, nil
}
