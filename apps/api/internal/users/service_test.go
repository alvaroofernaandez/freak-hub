package users_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users/usersmem"
)

func profile() users.ClerkProfile {
	return users.ClerkProfile{
		ClerkUserID: "user_123",
		Username:    "alvaro",
		DisplayName: "Álvaro",
		AvatarURL:   "https://img.clerk.com/alvaro.png",
		Email:       "alvaro@correo.com",
	}
}

func TestEnsureFromClerkCreatesTheMember(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	service := users.NewService(repo)

	user, err := service.EnsureFromClerk(context.Background(), profile())

	require.NoError(t, err)
	assert.NotEqual(t, "", user.ID.String())
	assert.Equal(t, "user_123", user.ClerkUserID)
	assert.Equal(t, "alvaro", user.Username)
	assert.Equal(t, "Álvaro", user.DisplayName)
	assert.Equal(t, 1, repo.Count())
}

func TestEnsureFromClerkIsIdempotent(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	service := users.NewService(repo)
	ctx := context.Background()

	first, err := service.EnsureFromClerk(ctx, profile())
	require.NoError(t, err)

	updated := profile()
	updated.Username = "alvarof"
	updated.DisplayName = "Álvaro F."

	second, err := service.EnsureFromClerk(ctx, updated)

	require.NoError(t, err)
	assert.Equal(t, first.ID, second.ID, "a repeated webhook must not create a second member")
	assert.Equal(t, "alvarof", second.Username)
	assert.Equal(t, "Álvaro F.", second.DisplayName)
	assert.Equal(t, 1, repo.Count())
}

func TestEnsureFromClerkNormalisesTheUsername(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	service := users.NewService(repo)

	input := profile()
	input.Username = "  ÁlvaroF  "

	user, err := service.EnsureFromClerk(context.Background(), input)

	require.NoError(t, err)
	assert.Equal(t, "álvarof", user.Username)
}

func TestEnsureFromClerkFallsBackToTheUsernameAsDisplayName(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	service := users.NewService(repo)

	input := profile()
	input.DisplayName = "   "

	user, err := service.EnsureFromClerk(context.Background(), input)

	require.NoError(t, err)
	assert.Equal(t, "alvaro", user.DisplayName)
}

func TestEnsureFromClerkRejectsAProfileWithoutClerkID(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	service := users.NewService(repo)

	input := profile()
	input.ClerkUserID = ""

	_, err := service.EnsureFromClerk(context.Background(), input)

	require.ErrorIs(t, err, users.ErrMissingClerkID)
	assert.Equal(t, 0, repo.Count())
}

func TestEnsureFromClerkRejectsAProfileWithoutUsername(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	service := users.NewService(repo)

	input := profile()
	input.Username = "  "

	_, err := service.EnsureFromClerk(context.Background(), input)

	require.ErrorIs(t, err, users.ErrInvalidUsername)
	assert.Equal(t, 0, repo.Count())
}

func TestByClerkIDReportsAnUnknownMember(t *testing.T) {
	t.Parallel()

	service := users.NewService(usersmem.New())

	_, err := service.ByClerkID(context.Background(), "user_nope")

	require.ErrorIs(t, err, users.ErrNotFound)
}

func TestByClerkIDReturnsTheStoredMember(t *testing.T) {
	t.Parallel()

	service := users.NewService(usersmem.New())
	ctx := context.Background()
	created, err := service.EnsureFromClerk(ctx, profile())
	require.NoError(t, err)

	found, err := service.ByClerkID(ctx, "user_123")

	require.NoError(t, err)
	assert.Equal(t, created.ID, found.ID)
}

func TestDeleteByClerkIDIsIdempotent(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	service := users.NewService(repo)
	ctx := context.Background()
	_, err := service.EnsureFromClerk(ctx, profile())
	require.NoError(t, err)

	require.NoError(t, service.DeleteByClerkID(ctx, "user_123"))
	require.NoError(t, service.DeleteByClerkID(ctx, "user_123"))
	assert.Equal(t, 0, repo.Count())
}

func TestEnsureFromClerkStoresTheNormalisedEmail(t *testing.T) {
	t.Parallel()

	service := users.NewService(usersmem.New())

	input := profile()
	input.Email = "  Alvaro@Correo.COM "

	user, err := service.EnsureFromClerk(context.Background(), input)

	require.NoError(t, err)
	assert.Equal(t, "alvaro@correo.com", user.Email)
}

func TestEnsureFromClerkToleratesAMemberWithoutEmail(t *testing.T) {
	t.Parallel()

	service := users.NewService(usersmem.New())

	input := profile()
	input.Email = ""

	user, err := service.EnsureFromClerk(context.Background(), input)

	require.NoError(t, err)
	assert.Equal(t, "", user.Email)
}
