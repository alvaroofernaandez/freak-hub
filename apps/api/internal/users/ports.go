package users

import (
	"context"
	"io"
)

// ProfileUpdate carries the optional profile fields a member wants to
// change. A nil pointer means "leave this field alone" — that is what lets
// PATCH /v1/me accept a partial body.
type ProfileUpdate struct {
	FirstName *string
	LastName  *string
	Username  *string
}

// ProfileUpdater is the outbound port towards Clerk for editing a member's
// own name and username. Clerk is the source of truth; the user.updated
// webhook (internal/webhooks/clerk.go) is what eventually persists the
// change locally.
type ProfileUpdater interface {
	UpdateProfile(ctx context.Context, clerkUserID string, update ProfileUpdate) (ClerkProfile, error)
}

// AvatarFile is the seekable, closable stream a multipart upload hands the
// domain. It is structurally identical to mime/multipart.File, spelled out
// here so this package never imports net/http or mime/multipart.
type AvatarFile interface {
	io.Reader
	io.ReaderAt
	io.Seeker
	io.Closer
}

// AvatarUploader is the outbound port towards Clerk for setting a member's
// profile image.
type AvatarUploader interface {
	UploadAvatar(ctx context.Context, clerkUserID string, file AvatarFile, contentType string, size int64) (ClerkProfile, error)
}
