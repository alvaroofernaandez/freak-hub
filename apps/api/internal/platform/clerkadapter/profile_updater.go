package clerkadapter

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	clerk "github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/user"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// ProfileUpdater edits a member's name and username through the Clerk
// Backend API. Clerk is the source of truth; the user.updated webhook
// (internal/webhooks/clerk.go) is what eventually persists the change
// locally — this adapter only talks to Clerk.
type ProfileUpdater struct {
	client *user.Client
}

// NewProfileUpdater builds the adapter from an already configured Clerk client.
func NewProfileUpdater(client *user.Client) *ProfileUpdater {
	return &ProfileUpdater{client: client}
}

// UpdateProfile implements users.ProfileUpdater.
func (u *ProfileUpdater) UpdateProfile(ctx context.Context, clerkUserID string, update users.ProfileUpdate) (users.ClerkProfile, error) {
	updated, err := u.client.Update(ctx, clerkUserID, &user.UpdateParams{
		FirstName: update.FirstName,
		LastName:  update.LastName,
		Username:  update.Username,
	})
	if err != nil {
		if isUsernameTakenError(err) {
			return users.ClerkProfile{}, users.ErrUsernameTaken
		}

		return users.ClerkProfile{}, fmt.Errorf("update clerk user %s: %w", clerkUserID, err)
	}

	return toClerkProfile(clerkUserID, updated), nil
}

// isUsernameTakenError reports whether err is Clerk's response for a
// duplicate username.
//
// Not verified against a live Clerk instance — there is no CLERK_SECRET_KEY
// in this environment. It relies on two independently documented, stable
// signals instead: the endpoint's documented 409 Conflict response, and
// Clerk's public "form_identifier_exists" error code, checked together for
// robustness in case either one changes independently.
func isUsernameTakenError(err error) bool {
	var apiErr *clerk.APIErrorResponse
	if !errors.As(err, &apiErr) {
		return false
	}

	if apiErr.HTTPStatusCode == http.StatusConflict {
		return true
	}

	for _, e := range apiErr.Errors {
		if e.Code == "form_identifier_exists" {
			return true
		}
	}

	return false
}

// toClerkProfile mirrors internal/webhooks/clerk.go's displayName()
// convention (first + last name, falling back to the username) so this
// adapter's response matches what the webhook will eventually persist.
func toClerkProfile(clerkUserID string, u *clerk.User) users.ClerkProfile {
	username := stringOrEmpty(u.Username)

	return users.ClerkProfile{
		ClerkUserID: clerkUserID,
		Username:    username,
		DisplayName: displayNameFrom(u.FirstName, u.LastName, username),
		AvatarURL:   stringOrEmpty(u.ImageURL),
	}
}

// displayNameFrom mirrors clerkUser.displayName() in
// internal/webhooks/clerk.go exactly, so this adapter's optimistic response
// matches what the webhook will eventually persist to Postgres.
func displayNameFrom(firstName, lastName *string, username string) string {
	full := strings.TrimSpace(strings.TrimSpace(stringOrEmpty(firstName)) + " " + strings.TrimSpace(stringOrEmpty(lastName)))
	if full != "" {
		return full
	}

	return strings.TrimSpace(username)
}

func stringOrEmpty(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}
