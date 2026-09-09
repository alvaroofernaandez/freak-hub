package clerkadapter

import (
	"context"
	"fmt"

	"github.com/clerk/clerk-sdk-go/v2/user"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// AvatarUploader replaces a member's profile image through the Clerk
// Backend API. Clerk is the source of truth; the user.updated webhook
// (internal/webhooks/clerk.go) is what eventually persists the change
// locally — this adapter only talks to Clerk.
type AvatarUploader struct {
	client *user.Client
}

// NewAvatarUploader builds the adapter from an already configured Clerk client.
func NewAvatarUploader(client *user.Client) *AvatarUploader {
	return &AvatarUploader{client: client}
}

// UploadAvatar implements users.AvatarUploader. contentType and size are
// part of the port's contract but Clerk's API does not need either one: the
// domain (users.Service.UploadAvatar) already validated them before this
// adapter was ever called, so they are accepted only to satisfy the
// interface.
func (a *AvatarUploader) UploadAvatar(ctx context.Context, clerkUserID string, file users.AvatarFile, _ string, _ int64) (users.ClerkProfile, error) {
	updated, err := a.client.UpdateProfileImage(ctx, clerkUserID, &user.UpdateProfileImageParams{File: file})
	if err != nil {
		return users.ClerkProfile{}, fmt.Errorf("upload clerk avatar %s: %w", clerkUserID, err)
	}

	return toClerkProfile(clerkUserID, updated), nil
}
