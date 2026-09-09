package users

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Service holds the member use cases. It depends on the Repository port
// always, and on the two Clerk-facing ports (profileUpdater, avatarUploader)
// only when the caller opts into them via ServiceOption — every existing
// caller of NewService(repo) keeps compiling unchanged.
type Service struct {
	repo           Repository
	profileUpdater ProfileUpdater
	avatarUploader AvatarUploader
}

// ServiceOption configures an optional collaborator of Service.
type ServiceOption func(*Service)

// WithProfileUpdater wires the outbound port UpdateProfile needs. Without it,
// UpdateProfile fails after local validation instead of panicking on a nil
// dereference.
func WithProfileUpdater(updater ProfileUpdater) ServiceOption {
	return func(s *Service) { s.profileUpdater = updater }
}

// WithAvatarUploader wires the outbound port UploadAvatar needs.
func WithAvatarUploader(uploader AvatarUploader) ServiceOption {
	return func(s *Service) { s.avatarUploader = uploader }
}

// NewService builds the member use cases on top of a Repository, plus
// whichever optional collaborators opts enable.
func NewService(repo Repository, opts ...ServiceOption) *Service {
	s := &Service{repo: repo}
	for _, opt := range opts {
		opt(s)
	}

	return s
}

// EnsureFromClerk projects a Clerk profile onto the local member table.
//
// It is driven by Clerk webhooks, which are delivered at least once and can
// arrive out of order, so it must be idempotent: keyed by ClerkUserID, it
// creates the member the first time and refreshes the mutable profile fields
// afterwards.
func (s *Service) EnsureFromClerk(ctx context.Context, profile ClerkProfile) (User, error) {
	clerkUserID := strings.TrimSpace(profile.ClerkUserID)
	if clerkUserID == "" {
		return User{}, ErrMissingClerkID
	}

	username := normaliseUsername(profile.Username)
	if username == "" {
		return User{}, ErrInvalidUsername
	}

	displayName := strings.TrimSpace(profile.DisplayName)
	if displayName == "" {
		displayName = username
	}

	user, err := s.repo.Upsert(ctx, User{
		ClerkUserID: clerkUserID,
		Username:    username,
		DisplayName: displayName,
		AvatarURL:   strings.TrimSpace(profile.AvatarURL),
		Email:       strings.ToLower(strings.TrimSpace(profile.Email)),
	})
	if err != nil {
		return User{}, fmt.Errorf("upsert member %s: %w", clerkUserID, err)
	}

	return user, nil
}

// ByClerkID resolves the member behind an authenticated session.
func (s *Service) ByClerkID(ctx context.Context, clerkUserID string) (User, error) {
	if strings.TrimSpace(clerkUserID) == "" {
		return User{}, ErrMissingClerkID
	}

	return s.repo.ByClerkID(ctx, clerkUserID)
}

// DeleteByClerkID removes a member after Clerk reports the account is gone.
// Deleting an unknown member is a no-op so a duplicated webhook stays harmless.
func (s *Service) DeleteByClerkID(ctx context.Context, clerkUserID string) error {
	if strings.TrimSpace(clerkUserID) == "" {
		return ErrMissingClerkID
	}

	return s.repo.DeleteByClerkID(ctx, clerkUserID)
}

// List returns a page of members ordered by member-since ascending
// (ADR-0011), and the cursor to fetch the next page, or nil when this is the
// last one.
func (s *Service) List(ctx context.Context, after *Cursor, limit int) ([]User, *Cursor, error) {
	if limit < MinListLimit || limit > MaxListLimit {
		return nil, nil, ErrInvalidLimit
	}

	// Ask for one extra row: its presence, not a COUNT(*), is what tells us
	// whether another page follows (ADR-0011).
	rows, err := s.repo.List(ctx, after, limit+1)
	if err != nil {
		return nil, nil, fmt.Errorf("list members: %w", err)
	}

	if len(rows) <= limit {
		return rows, nil, nil
	}

	rows = rows[:limit]
	last := rows[len(rows)-1]
	next := Cursor{CreatedAt: last.CreatedAt, ID: last.ID}

	return rows, &next, nil
}

// normaliseUsername keeps handles comparable: trimmed and lower-cased, so
// "  ÁlvaroF  " and "álvarof" never end up as two different members.
func normaliseUsername(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

// UpdateProfile edits a member's own name and username (PATCH /v1/me).
//
// Order matters, exactly like Invite in internal/invitations: everything
// that can be validated locally is checked first, so a malformed field never
// reaches Clerk, and the local row is confirmed to exist before Clerk is
// ever called — an unknown member must never trigger an external mutation.
//
// The returned User is an optimistic projection, not a persisted write: it
// reads the local row (to keep ID, Email, AvatarURL and everything else
// Clerk was not asked to change) and overlays what Clerk just confirmed.
// Clerk remains the source of truth; the user.updated webhook
// (internal/webhooks/clerk.go) is what eventually persists this to
// Postgres, asynchronously. Doing it this way means the caller sees their
// own edit reflected immediately, without a second write here racing the
// webhook.
func (s *Service) UpdateProfile(ctx context.Context, clerkUserID string, update ProfileUpdate) (User, error) {
	clerkUserID = strings.TrimSpace(clerkUserID)
	if clerkUserID == "" {
		return User{}, ErrMissingClerkID
	}

	if update.FirstName == nil && update.LastName == nil && update.Username == nil {
		return User{}, ErrNoProfileChanges
	}

	normalized := ProfileUpdate{}

	if update.FirstName != nil {
		trimmed, err := validateName(*update.FirstName)
		if err != nil {
			return User{}, err
		}

		normalized.FirstName = &trimmed
	}

	if update.LastName != nil {
		trimmed, err := validateName(*update.LastName)
		if err != nil {
			return User{}, err
		}

		normalized.LastName = &trimmed
	}

	if update.Username != nil {
		trimmed, err := validateUsername(*update.Username)
		if err != nil {
			return User{}, err
		}

		normalized.Username = &trimmed
	}

	if s.profileUpdater == nil {
		return User{}, fmt.Errorf("update profile %s: profile updater is not configured", clerkUserID)
	}

	// Read-only check before touching Clerk: an unknown local member must
	// never trigger an external mutation.
	base, err := s.repo.ByClerkID(ctx, clerkUserID)
	if err != nil {
		return User{}, err
	}

	profile, err := s.profileUpdater.UpdateProfile(ctx, clerkUserID, normalized)
	if err != nil {
		if errors.Is(err, ErrUsernameTaken) {
			return User{}, err
		}

		return User{}, fmt.Errorf("update clerk profile %s: %w", clerkUserID, err)
	}

	base.Username = normaliseUsername(profile.Username)
	base.DisplayName = profile.DisplayName

	return base, nil
}

// UploadAvatar replaces a member's profile image (POST /v1/me/avatar).
//
// Same order as UpdateProfile: content type and size are validated locally
// before anything reaches Clerk, the local row must exist, and the returned
// User is the same kind of optimistic projection — see UpdateProfile's
// comment for why.
func (s *Service) UploadAvatar(ctx context.Context, clerkUserID string, file AvatarFile, contentType string, size int64) (User, error) {
	clerkUserID = strings.TrimSpace(clerkUserID)
	if clerkUserID == "" {
		return User{}, ErrMissingClerkID
	}

	if !AllowedAvatarContentTypes[contentType] {
		return User{}, ErrAvatarUnsupportedType
	}

	if size > MaxAvatarBytes {
		return User{}, ErrAvatarTooLarge
	}

	if s.avatarUploader == nil {
		return User{}, fmt.Errorf("upload avatar %s: avatar uploader is not configured", clerkUserID)
	}

	base, err := s.repo.ByClerkID(ctx, clerkUserID)
	if err != nil {
		return User{}, err
	}

	profile, err := s.avatarUploader.UploadAvatar(ctx, clerkUserID, file, contentType, size)
	if err != nil {
		return User{}, fmt.Errorf("upload clerk avatar %s: %w", clerkUserID, err)
	}

	base.AvatarURL = profile.AvatarURL

	return base, nil
}

// validateName trims a first or last name and rejects it once it exceeds
// MaxNameLength. An empty result after trimming is allowed: Clerk itself
// decides whether clearing a name is acceptable.
func validateName(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if utf8.RuneCountInString(trimmed) > MaxNameLength {
		return "", ErrNameTooLong
	}

	return trimmed, nil
}

// validateUsername trims a requested username and enforces the two local
// rules Clerk's own username policy does not cover here: a length window,
// and never letting a username be only digits (which would be indistinguishable
// from an id at a glance).
func validateUsername(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)

	length := utf8.RuneCountInString(trimmed)
	if length < MinUsernameLength || length > MaxUsernameLength {
		return "", ErrUsernameInvalidLength
	}

	if isNumericOnly(trimmed) {
		return "", ErrUsernameNumericOnly
	}

	return trimmed, nil
}

// isNumericOnly reports whether s is made up exclusively of digits.
func isNumericOnly(s string) bool {
	for _, r := range s {
		if !unicode.IsDigit(r) {
			return false
		}
	}

	return true
}
