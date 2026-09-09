package users_test

import (
	"bytes"
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users/usersmem"
)

// seedAt creates a member whose CreatedAt is pinned to at, so pagination order
// is deterministic instead of depending on wall-clock timing.
func seedAt(t *testing.T, repo *usersmem.Repository, service *users.Service, clerkID, username string, at time.Time) users.User {
	t.Helper()

	repo.NowFunc = func() time.Time { return at }

	user, err := service.EnsureFromClerk(context.Background(), users.ClerkProfile{
		ClerkUserID: clerkID,
		Username:    username,
		DisplayName: username,
	})
	require.NoError(t, err)

	return user
}

func usernames(members []users.User) []string {
	names := make([]string, len(members))
	for i, member := range members {
		names[i] = member.Username
	}

	return names
}

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

func TestListReturnsMembersOrderedByMemberSinceAscending(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	service := users.NewService(repo)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	seedAt(t, repo, service, "user_3", "carol", base.Add(2*time.Hour))
	seedAt(t, repo, service, "user_1", "alvaro", base)
	seedAt(t, repo, service, "user_2", "bea", base.Add(time.Hour))

	members, next, err := service.List(context.Background(), nil, 10)

	require.NoError(t, err)
	assert.Nil(t, next, "the last page must not carry a next cursor")
	assert.Equal(t, []string{"alvaro", "bea", "carol"}, usernames(members))
}

func TestListPaginatesWithACursor(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	service := users.NewService(repo)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	seedAt(t, repo, service, "user_1", "alvaro", base)
	seedAt(t, repo, service, "user_2", "bea", base.Add(time.Hour))
	seedAt(t, repo, service, "user_3", "carol", base.Add(2*time.Hour))

	firstPage, cursor, err := service.List(context.Background(), nil, 2)
	require.NoError(t, err)
	require.NotNil(t, cursor, "a page that is not the last one must carry a cursor")
	assert.Equal(t, []string{"alvaro", "bea"}, usernames(firstPage))

	secondPage, nextCursor, err := service.List(context.Background(), cursor, 2)
	require.NoError(t, err)
	assert.Nil(t, nextCursor)
	assert.Equal(t, []string{"carol"}, usernames(secondPage))
}

func TestListRejectsAnOutOfRangeLimit(t *testing.T) {
	t.Parallel()

	service := users.NewService(usersmem.New())

	_, _, err := service.List(context.Background(), nil, 0)
	require.ErrorIs(t, err, users.ErrInvalidLimit)

	_, _, err = service.List(context.Background(), nil, 101)
	require.ErrorIs(t, err, users.ErrInvalidLimit)
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

// --- UpdateProfile / UploadAvatar -----------------------------------------
//
// These stubs mirror stubSender in internal/invitations/service_test.go:
// defined here rather than mocking the Clerk SDK, so validation-before-Clerk
// can be proven ("an invalid field must never reach Clerk") without any
// network access.

type stubProfileUpdater struct {
	profile    users.ClerkProfile
	err        error
	calledWith *users.ProfileUpdate
}

func (s *stubProfileUpdater) UpdateProfile(_ context.Context, _ string, update users.ProfileUpdate) (users.ClerkProfile, error) {
	s.calledWith = &update

	return s.profile, s.err
}

type stubAvatarUploader struct {
	profile users.ClerkProfile
	err     error
	called  bool
}

func (s *stubAvatarUploader) UploadAvatar(_ context.Context, _ string, _ users.AvatarFile, _ string, _ int64) (users.ClerkProfile, error) {
	s.called = true

	return s.profile, s.err
}

// fakeAvatarFile satisfies users.AvatarFile with an in-memory buffer.
type fakeAvatarFile struct {
	*bytes.Reader
}

func (fakeAvatarFile) Close() error { return nil }

func newFakeAvatarFile(data []byte) users.AvatarFile {
	return fakeAvatarFile{bytes.NewReader(data)}
}

func strPtr(s string) *string { return &s }

// newProfileService builds a Service wired with whichever of the two
// optional Clerk ports the caller provides, on top of repo.
func newProfileService(repo *usersmem.Repository, updater users.ProfileUpdater, uploader users.AvatarUploader) *users.Service {
	var opts []users.ServiceOption
	if updater != nil {
		opts = append(opts, users.WithProfileUpdater(updater))
	}

	if uploader != nil {
		opts = append(opts, users.WithAvatarUploader(uploader))
	}

	return users.NewService(repo, opts...)
}

// seedLocalMember creates a member directly in repo, bypassing Clerk, so
// UpdateProfile/UploadAvatar tests can control exactly which local row
// exists without depending on EnsureFromClerk's own validation.
func seedLocalMember(t *testing.T, repo *usersmem.Repository, clerkID, username, email, avatarURL string) users.User {
	t.Helper()

	plain := users.NewService(repo)
	user, err := plain.EnsureFromClerk(context.Background(), users.ClerkProfile{
		ClerkUserID: clerkID,
		Username:    username,
		DisplayName: username,
		Email:       email,
		AvatarURL:   avatarURL,
	})
	require.NoError(t, err)

	return user
}

func TestUpdateProfileRejectsNoFields(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	seedLocalMember(t, repo, "user_123", "alvaro", "alvaro@correo.com", "")
	updater := &stubProfileUpdater{}
	service := newProfileService(repo, updater, nil)

	_, err := service.UpdateProfile(context.Background(), "user_123", users.ProfileUpdate{})

	require.ErrorIs(t, err, users.ErrNoProfileChanges)
	assert.Nil(t, updater.calledWith, "clerk must never be called with no fields to change")
}

func TestUpdateProfileRejectsAUsernameThatIsTooShort(t *testing.T) {
	t.Parallel()

	for _, username := range []string{"a", "ab"} {
		repo := usersmem.New()
		seedLocalMember(t, repo, "user_123", "alvaro", "alvaro@correo.com", "")
		updater := &stubProfileUpdater{}
		service := newProfileService(repo, updater, nil)

		_, err := service.UpdateProfile(context.Background(), "user_123", users.ProfileUpdate{Username: strPtr(username)})

		require.ErrorIs(t, err, users.ErrUsernameInvalidLength, "username %q", username)
		assert.Nil(t, updater.calledWith, "an invalid username must never reach Clerk")
	}
}

func TestUpdateProfileRejectsAUsernameThatIsTooLong(t *testing.T) {
	t.Parallel()

	for _, username := range []string{
		"abcdefghijklmnopqrstuvwxy",    // 25 chars
		"abcdefghijklmnopqrstuvwxyzab", // 29 chars
	} {
		repo := usersmem.New()
		seedLocalMember(t, repo, "user_123", "alvaro", "alvaro@correo.com", "")
		updater := &stubProfileUpdater{}
		service := newProfileService(repo, updater, nil)

		_, err := service.UpdateProfile(context.Background(), "user_123", users.ProfileUpdate{Username: strPtr(username)})

		require.ErrorIs(t, err, users.ErrUsernameInvalidLength, "username %q", username)
		assert.Nil(t, updater.calledWith, "an invalid username must never reach Clerk")
	}
}

func TestUpdateProfileRejectsANumericOnlyUsername(t *testing.T) {
	t.Parallel()

	for _, username := range []string{"123", "000000"} {
		repo := usersmem.New()
		seedLocalMember(t, repo, "user_123", "alvaro", "alvaro@correo.com", "")
		updater := &stubProfileUpdater{}
		service := newProfileService(repo, updater, nil)

		_, err := service.UpdateProfile(context.Background(), "user_123", users.ProfileUpdate{Username: strPtr(username)})

		require.ErrorIs(t, err, users.ErrUsernameNumericOnly, "username %q", username)
		assert.Nil(t, updater.calledWith, "an invalid username must never reach Clerk")
	}
}

func TestUpdateProfileRejectsAnOverlongName(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	seedLocalMember(t, repo, "user_123", "alvaro", "alvaro@correo.com", "")
	updater := &stubProfileUpdater{}
	service := newProfileService(repo, updater, nil)

	longName := ""
	for len(longName) <= users.MaxNameLength {
		longName += "a"
	}

	_, err := service.UpdateProfile(context.Background(), "user_123", users.ProfileUpdate{FirstName: strPtr(longName)})

	require.ErrorIs(t, err, users.ErrNameTooLong)
	assert.Nil(t, updater.calledWith, "an invalid name must never reach Clerk")
}

func TestUpdateProfileRequiresAnExistingLocalMember(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	updater := &stubProfileUpdater{profile: users.ClerkProfile{Username: "nuevo", DisplayName: "Nuevo"}}
	service := newProfileService(repo, updater, nil)

	_, err := service.UpdateProfile(context.Background(), "user_ghost", users.ProfileUpdate{Username: strPtr("nuevo")})

	require.ErrorIs(t, err, users.ErrNotFound)
	assert.Nil(t, updater.calledWith, "clerk must never be touched for a member with no local row")
}

func TestUpdateProfilePropagatesUsernameTaken(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	seedLocalMember(t, repo, "user_123", "alvaro", "alvaro@correo.com", "")
	updater := &stubProfileUpdater{err: users.ErrUsernameTaken}
	service := newProfileService(repo, updater, nil)

	_, err := service.UpdateProfile(context.Background(), "user_123", users.ProfileUpdate{Username: strPtr("tomado")})

	require.ErrorIs(t, err, users.ErrUsernameTaken)
}

func TestUpdateProfileReturnsTheOptimisticMember(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	seeded := seedLocalMember(t, repo, "user_123", "alvaro", "alvaro@correo.com", "https://img.clerk.com/alvaro.png")
	updater := &stubProfileUpdater{profile: users.ClerkProfile{
		ClerkUserID: "user_123",
		Username:    "nuevo",
		DisplayName: "Nuevo Nombre",
	}}
	service := newProfileService(repo, updater, nil)

	updated, err := service.UpdateProfile(context.Background(), "user_123", users.ProfileUpdate{
		FirstName: strPtr("Nuevo"),
		LastName:  strPtr("Nombre"),
		Username:  strPtr("nuevo"),
	})

	require.NoError(t, err)
	assert.Equal(t, "nuevo", updated.Username)
	assert.Equal(t, "Nuevo Nombre", updated.DisplayName)
	assert.Equal(t, seeded.ID, updated.ID, "the optimistic response keeps the local id")
	assert.Equal(t, seeded.Email, updated.Email, "the optimistic response keeps fields Clerk did not touch")
	assert.Equal(t, seeded.AvatarURL, updated.AvatarURL)

	// The write is optimistic only: the repository itself was never touched.
	// The user.updated webhook is what will eventually persist this.
	assert.Equal(t, 1, repo.Count())

	stillOld, err := repo.ByClerkID(context.Background(), "user_123")
	require.NoError(t, err)
	assert.Equal(t, "alvaro", stillOld.Username, "the repository row must not have been mutated")
}

func TestUploadAvatarRejectsAnUnsupportedContentType(t *testing.T) {
	t.Parallel()

	for _, contentType := range []string{"application/pdf", "text/plain"} {
		repo := usersmem.New()
		seedLocalMember(t, repo, "user_123", "alvaro", "alvaro@correo.com", "")
		uploader := &stubAvatarUploader{}
		service := newProfileService(repo, nil, uploader)

		_, err := service.UploadAvatar(context.Background(), "user_123", newFakeAvatarFile([]byte("x")), contentType, 3)

		require.ErrorIs(t, err, users.ErrAvatarUnsupportedType, "content type %q", contentType)
		assert.False(t, uploader.called, "an unsupported content type must never reach Clerk")
	}
}

func TestUploadAvatarRejectsAFileThatIsTooLarge(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	seedLocalMember(t, repo, "user_123", "alvaro", "alvaro@correo.com", "")
	uploader := &stubAvatarUploader{}
	service := newProfileService(repo, nil, uploader)

	_, err := service.UploadAvatar(context.Background(), "user_123", newFakeAvatarFile([]byte("x")), "image/png", users.MaxAvatarBytes+1)

	require.ErrorIs(t, err, users.ErrAvatarTooLarge)
	assert.False(t, uploader.called, "an oversized file must never reach Clerk")
}

func TestUploadAvatarRequiresAnExistingLocalMember(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	uploader := &stubAvatarUploader{profile: users.ClerkProfile{AvatarURL: "https://img.clerk.com/nuevo.png"}}
	service := newProfileService(repo, nil, uploader)

	_, err := service.UploadAvatar(context.Background(), "user_ghost", newFakeAvatarFile([]byte("x")), "image/png", 3)

	require.ErrorIs(t, err, users.ErrNotFound)
	assert.False(t, uploader.called, "clerk must never be touched for a member with no local row")
}

func TestUploadAvatarReturnsTheOptimisticMember(t *testing.T) {
	t.Parallel()

	repo := usersmem.New()
	seeded := seedLocalMember(t, repo, "user_123", "alvaro", "alvaro@correo.com", "https://img.clerk.com/old.png")
	uploader := &stubAvatarUploader{profile: users.ClerkProfile{AvatarURL: "https://img.clerk.com/nuevo.png"}}
	service := newProfileService(repo, nil, uploader)

	updated, err := service.UploadAvatar(context.Background(), "user_123", newFakeAvatarFile([]byte("x")), "image/png", 3)

	require.NoError(t, err)
	assert.Equal(t, "https://img.clerk.com/nuevo.png", updated.AvatarURL)
	assert.Equal(t, seeded.Username, updated.Username, "the optimistic response keeps fields Clerk did not touch")
	assert.Equal(t, 1, repo.Count())

	stillOld, err := repo.ByClerkID(context.Background(), "user_123")
	require.NoError(t, err)
	assert.Equal(t, "https://img.clerk.com/old.png", stillOld.AvatarURL, "the repository row must not have been mutated")
}
