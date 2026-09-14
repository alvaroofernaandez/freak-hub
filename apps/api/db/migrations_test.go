package db_test

import (
	"io/fs"
	"strings"
	"testing"

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
