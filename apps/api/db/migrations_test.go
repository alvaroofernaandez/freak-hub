package db_test

import (
	"database/sql"
	"io/fs"
	"os"
	"strings"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/db"
)

// sectionBody returns what a migration declares under one goose marker, with
// the goose annotation lines themselves stripped. It is deliberately textual:
// the point is to catch a migration that ships an empty half, which a real
// Postgres never complains about because it simply has nothing to run.
func sectionBody(migration, marker string) string {
	_, after, found := strings.Cut(migration, marker)
	if !found {
		return ""
	}

	if next := strings.Index(after, "-- +goose Down"); next != -1 && marker != "-- +goose Down" {
		after = after[:next]
	}

	var body strings.Builder
	for _, line := range strings.Split(after, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "-- +goose") || strings.HasPrefix(trimmed, "--") {
			continue
		}

		body.WriteString(trimmed)
	}

	return body.String()
}

// TestEveryMigrationDeclaresAnUpAndADown guards the rule AGENTS.md states and
// the CI `migrations` job exercises: every migration must roll back. CI proves
// it against a real Postgres; this proves the Down was written at all, which
// is the half that gets forgotten and only surfaces when a rollback is
// already needed.
func TestEveryMigrationDeclaresAnUpAndADown(t *testing.T) {
	t.Parallel()

	entries, err := fs.Glob(db.Migrations, "migrations/*.sql")
	require.NoError(t, err)
	require.NotEmpty(t, entries, "the migrations must be embedded")

	for _, entry := range entries {
		raw, err := fs.ReadFile(db.Migrations, entry)
		require.NoError(t, err, entry)

		migration := string(raw)

		assert.NotEmptyf(t, sectionBody(migration, "-- +goose Up"),
			"%s declares no statement under `-- +goose Up`", entry)
		assert.NotEmptyf(t, sectionBody(migration, "-- +goose Down"),
			"%s declares no statement under `-- +goose Down`: a migration that cannot roll back is not finished", entry)
	}
}

// The backfill migration is the one piece of SQL in this repository that
// carries logic — lower(email), the IS NULL guard, the self-link exclusion and
// the tiebreak between duplicate accepted invitations — so it gets a test
// against a real Postgres instead of a careful read.
//
// It skips without TEST_DATABASE_URL so `go test ./...` stays green on a
// machine (and in the CI job) with no database. The `migrations` workflow job
// sets it.
const (
	versionBeforeBackfill int64 = 20260914000001
	versionBackfill       int64 = 20260914120000
)

// migrationsDB opens the database the backfill tests run against, or skips
// them. It also leaves goose configured against the embedded migrations.
func migrationsDB(t *testing.T) *sql.DB {
	t.Helper()

	url := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set: this test needs a real Postgres (pnpm infra:up)")
	}

	connection, err := sql.Open("pgx", url)
	require.NoError(t, err)
	t.Cleanup(func() { assert.NoError(t, connection.Close()) })

	require.NoError(t, connection.PingContext(t.Context()))

	goose.SetBaseFS(db.Migrations)
	goose.SetLogger(goose.NopLogger())
	require.NoError(t, goose.SetDialect("postgres"))

	return connection
}

// seedPreBackfill rebuilds the schema up to just before the backfill and fills
// it with the shapes the migration has to tell apart. Every member starts with
// invited_by NULL, which is exactly the state the bug left behind.
func seedPreBackfill(t *testing.T, connection *sql.DB) {
	t.Helper()

	require.NoError(t, goose.DownToContext(t.Context(), connection, "migrations", 0))
	require.NoError(t, goose.UpToContext(t.Context(), connection, "migrations", versionBeforeBackfill))

	_, err := connection.ExecContext(t.Context(), `
INSERT INTO members (id, clerk_user_id, username, display_name, avatar_url, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a', 'alvaro', 'Álvaro', '', 'alvaro@correo.com'),
  ('22222222-2222-2222-2222-222222222222', 'user_b', 'alex',   'Alex',   '', 'Alex@Correo.com'),
  ('33333333-3333-3333-3333-333333333333', 'user_c', 'sole',   'Sole',   '', 'sole@correo.com'),
  ('44444444-4444-4444-4444-444444444444', 'user_d', 'raro',   'Raro',   '', 'raro@correo.com'),
  ('55555555-5555-5555-5555-555555555555', 'user_e', 'dupli',  'Dupli',  '', 'dupli@correo.com');

INSERT INTO invitations (clerk_invitation_id, email, inviter_id, status, accepted_at) VALUES
  -- Matched on lower(email) even though the member stored it capitalised.
  ('inv_alex',    'alex@correo.com',  '11111111-1111-1111-1111-111111111111', 'accepted', now()),
  -- Still pending: nothing to backfill from.
  ('inv_sole',    'sole@correo.com',  '11111111-1111-1111-1111-111111111111', 'pending',  NULL),
  -- Self-link: a member recorded as their own inviter.
  ('inv_raro',    'raro@correo.com',  '44444444-4444-4444-4444-444444444444', 'accepted', now()),
  -- Two accepted invitations for one address, which user.deleted plus a
  -- re-invite makes reachable. The most recent one must win, every time.
  ('inv_dupli_1', 'dupli@correo.com', '11111111-1111-1111-1111-111111111111', 'accepted', now() - interval '2 days'),
  ('inv_dupli_2', 'dupli@correo.com', '33333333-3333-3333-3333-333333333333', 'accepted', now() - interval '1 day');
`)
	require.NoError(t, err)
}

// invitedBy reads back the username of whoever a member is recorded as having
// been invited by, or "" when the column is still NULL.
func invitedBy(t *testing.T, connection *sql.DB, username string) string {
	t.Helper()

	var inviter *string
	row := connection.QueryRowContext(t.Context(), `
SELECT i.username
FROM   members m
LEFT   JOIN members i ON i.id = m.invited_by
WHERE  m.username = $1`, username)
	require.NoError(t, row.Scan(&inviter))

	if inviter == nil {
		return ""
	}

	return *inviter
}

func TestBackfillRecordsTheInviterOfTheMostRecentAcceptedInvitation(t *testing.T) {
	connection := migrationsDB(t)
	seedPreBackfill(t, connection)

	require.NoError(t, goose.UpToContext(t.Context(), connection, "migrations", versionBackfill))

	assert.Equal(t, "alvaro", invitedBy(t, connection, "alex"),
		"lower(email) is the same key the webhook matches on")
	assert.Equal(t, "sole", invitedBy(t, connection, "dupli"),
		"two accepted invitations for one address must resolve to the latest, not to whichever row Postgres reaches first")
	assert.Equal(t, "", invitedBy(t, connection, "alvaro"),
		"a founder has no accepted invitation to recover")
	assert.Equal(t, "", invitedBy(t, connection, "sole"),
		"a pending invitation says nothing about who is already a member")
	assert.Equal(t, "", invitedBy(t, connection, "raro"),
		"a self-link would satisfy the foreign key and corrupt the invitation tree")
}

func TestBackfillDownClearsEveryValueItWrote(t *testing.T) {
	connection := migrationsDB(t)
	seedPreBackfill(t, connection)

	require.NoError(t, goose.UpToContext(t.Context(), connection, "migrations", versionBackfill))
	require.NoError(t, goose.DownToContext(t.Context(), connection, "migrations", versionBeforeBackfill))

	for _, username := range []string{"alvaro", "alex", "sole", "raro", "dupli"} {
		assert.Equalf(t, "", invitedBy(t, connection, username), "%s should be back to NULL", username)
	}
}
