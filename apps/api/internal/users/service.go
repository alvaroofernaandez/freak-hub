package users

import (
	"context"
	"fmt"
	"strings"
)

// Service holds the member use cases. It depends on the Repository port only,
// which is what lets the whole thing be tested without Postgres.
type Service struct {
	repo Repository
}

// NewService builds the member use cases on top of a Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
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

// normaliseUsername keeps handles comparable: trimmed and lower-cased, so
// "  ÁlvaroF  " and "álvarof" never end up as two different members.
func normaliseUsername(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}
