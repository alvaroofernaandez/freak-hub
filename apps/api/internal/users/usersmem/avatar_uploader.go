package usersmem

import (
	"context"
	"sync"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// AvatarUploader is a configurable fake of users.AvatarUploader. Router
// tests inject it so POST /v1/me/avatar can be exercised end to end without
// ever calling Clerk.
type AvatarUploader struct {
	mu sync.Mutex

	// Profile is what UploadAvatar returns on success.
	Profile users.ClerkProfile
	// Err, when set, is what UploadAvatar returns instead of Profile.
	Err error
	// Called records whether the fake was invoked.
	Called bool
}

// NewAvatarUploader builds a fake that succeeds by default.
func NewAvatarUploader() *AvatarUploader {
	return &AvatarUploader{}
}

// UploadAvatar implements users.AvatarUploader.
func (f *AvatarUploader) UploadAvatar(_ context.Context, _ string, _ users.AvatarFile, _ string, _ int64) (users.ClerkProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.Called = true

	if f.Err != nil {
		return users.ClerkProfile{}, f.Err
	}

	return f.Profile, nil
}
