package db_test

import (
	"database/sql"
	"strings"
	"testing"

	"github.com/pressly/goose/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The library schema is the first migration in this repository whose value is
// almost entirely in its constraints: three unique or referential invariants
// that domain.md says the database has to hold, because Go cannot hold them
// against two concurrent writes. A constraint nobody exercises is a comment,
// so every one of them gets a row that must be refused here.
//
// Like the backfill tests above, these need a throwaway Postgres and skip
// without TEST_DATABASE_URL. The `migrations` CI job sets it.
const (
	versionBeforeLibrary int64 = 20260914120000
	versionLibrary       int64 = 20260914130000
)

const (
	memberID     = "11111111-1111-1111-1111-111111111111"
	otherMember  = "22222222-2222-2222-2222-222222222222"
	importedWork = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	manualWork   = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	baseGame     = "cccccccc-cccc-cccc-cccc-cccccccccccc"
	expansion    = "dddddddd-dddd-dddd-dddd-dddddddddddd"
	accentedWork = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
	percentWork  = "ffffffff-ffff-ffff-ffff-ffffffffffff"
)

// seedLibrary rebuilds the schema from zero up to the library migration and
// fills it with the shapes the constraints have to tell apart.
func seedLibrary(t *testing.T, connection *sql.DB) {
	t.Helper()

	require.NoError(t, goose.DownToContext(t.Context(), connection, "migrations", 0))
	require.NoError(t, goose.UpToContext(t.Context(), connection, "migrations", versionLibrary))

	_, err := connection.ExecContext(t.Context(), `
INSERT INTO members (id, clerk_user_id, username, display_name) VALUES
  ('`+memberID+`', 'user_a', 'alvaro', 'Álvaro'),
  ('`+otherMember+`', 'user_b', 'alex',  'Alex');

INSERT INTO works (id, title, category, source, source_id) VALUES
  ('`+importedWork+`', 'Fullmetal Alchemist: Brotherhood', 'anime', 'anilist', '5114'),
  ('`+manualWork+`',   'Un fanzine que no cataloga nadie', 'manga', 'manual',  NULL),
  ('`+baseGame+`',     'Terraforming Mars',                'boardgame', 'bgg', '167791'),
  ('`+accentedWork+`', 'Pokémon: Índigo',                  'anime', 'anilist', '527'),
  ('`+percentWork+`',  '100% Teacher',                     'manga', 'manual',  NULL);

INSERT INTO works (id, title, category, source, source_id, expansion_of) VALUES
  ('`+expansion+`', 'Terraforming Mars: Preludio', 'boardgame', 'bgg', '247030', '`+baseGame+`');

INSERT INTO library_entries (member_id, work_id, status) VALUES
  ('`+memberID+`', '`+importedWork+`', 'in_progress');
`)
	require.NoError(t, err)
}

func TestLibrarySchemaHoldsTheInvariantsTheDomainCannot(t *testing.T) {
	connection := migrationsDB(t)
	seedLibrary(t, connection)

	exec := func(statement string) error {
		_, err := connection.ExecContext(t.Context(), statement)

		return err
	}

	t.Run("a member holds at most one entry per work", func(t *testing.T) {
		err := exec(`INSERT INTO library_entries (member_id, work_id, status)
                     VALUES ('` + memberID + `', '` + importedWork + `', 'completed')`)
		require.Error(t, err, "domain rule 1: a second entry for the same pair must be refused by the database")
		assert.Contains(t, err.Error(), "library_entries_member_work_idx")
	})

	t.Run("another member may keep the same work", func(t *testing.T) {
		assert.NoError(t, exec(`INSERT INTO library_entries (member_id, work_id, status)
                                VALUES ('`+otherMember+`', '`+importedWork+`', 'wishlist')`),
			"one shared work with one row per person is the whole point of the split")
	})

	t.Run("an imported work is unique by source and source_id", func(t *testing.T) {
		err := exec(`INSERT INTO works (title, category, source, source_id)
                     VALUES ('FMA:B otra vez', 'anime', 'anilist', '5114')`)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "works_source_idx")
	})

	t.Run("the same source_id in another catalogue is a different work", func(t *testing.T) {
		assert.NoError(t, exec(`INSERT INTO works (title, category, source, source_id)
                                VALUES ('Algo en TMDB', 'film', 'tmdb', '5114')`),
			"the uniqueness is over the pair, not over source_id alone")
	})

	t.Run("manual works are not deduplicated", func(t *testing.T) {
		assert.NoError(t, exec(`INSERT INTO works (title, category, source, source_id)
                                VALUES ('Un fanzine que no cataloga nadie', 'manga', 'manual', NULL)`),
			"source_id is NULL for manual entries and the partial index leaves them out on purpose")
	})

	t.Run("a work in somebody's library cannot be deleted", func(t *testing.T) {
		err := exec(`DELETE FROM works WHERE id = '` + importedWork + `'`)
		require.Error(t, err, "domain rule 3: a work is shared history and is never deleted")
		assert.Contains(t, err.Error(), "library_entries_work_id_fkey")
	})

	t.Run("a base game cannot be deleted while an expansion points at it", func(t *testing.T) {
		err := exec(`DELETE FROM works WHERE id = '` + baseGame + `'`)
		require.Error(t, err, "ADR-0006: an expansion linked to nothing is worse than no expansion")
		assert.Contains(t, err.Error(), "works_expansion_of_fkey")
	})

	t.Run("progress cannot go backwards past zero", func(t *testing.T) {
		err := exec(`UPDATE library_entries SET progress = -1 WHERE member_id = '` + memberID + `'`)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "library_entries_progress_check")
	})

	t.Run("a rating outside one to ten is refused", func(t *testing.T) {
		for _, rating := range []string{"0", "11"} {
			err := exec(`UPDATE library_entries SET rating = ` + rating + ` WHERE member_id = '` + memberID + `'`)
			require.Errorf(t, err, "rating %s is outside the scale", rating)
			assert.Contains(t, err.Error(), "library_entries_rating_check")
		}
	})

	t.Run("a rating is accepted whatever the status", func(t *testing.T) {
		assert.NoError(t, exec(`UPDATE library_entries SET rating = 9, status = 'wishlist'
                                WHERE member_id = '`+memberID+`'`),
			"domain rule 2 belongs to the service: the schema owns the 1..10 scale and nothing more")
	})

	t.Run("metadata defaults to an empty object and is never null", func(t *testing.T) {
		var metadata string
		require.NoError(t, connection.QueryRowContext(t.Context(),
			`SELECT metadata::text FROM works WHERE id = '`+manualWork+`'`).Scan(&metadata))
		assert.Equal(t, "{}", metadata)

		assert.Error(t, exec(`UPDATE works SET metadata = NULL WHERE id = '`+manualWork+`'`))
	})

	t.Run("leaving the group takes your entries and leaves the catalogue", func(t *testing.T) {
		require.NoError(t, exec(`DELETE FROM members WHERE id = '`+memberID+`'`))

		var entries, works int
		require.NoError(t, connection.QueryRowContext(t.Context(),
			`SELECT count(*) FROM library_entries WHERE member_id = '`+memberID+`'`).Scan(&entries))
		require.NoError(t, connection.QueryRowContext(t.Context(),
			`SELECT count(*) FROM works WHERE id = '`+importedWork+`'`).Scan(&works))

		assert.Zero(t, entries, "domain rule 4: a member's entries go with them")
		assert.Equal(t, 1, works, "domain rule 3: their works stay")
	})
}

// The contract promises the title search is case- AND accent-insensitive, which
// in a Spanish-language product is the difference between finding Pokémon and
// not finding it. The folding happens in the schema — immutable_unaccent over
// an installed extension — so it is the schema that has to prove it works.
func TestTheTitleSearchFoldsCaseAndAccents(t *testing.T) {
	connection := migrationsDB(t)
	seedLibrary(t, connection)

	// The same expression works_title_search_idx indexes and ListWorks spells,
	// with the term escaped so a % from the caller stays a literal percent.
	const search = `
SELECT title FROM works
WHERE immutable_unaccent(lower(title)) LIKE
      '%' || replace(replace(replace(
          immutable_unaccent(lower($1)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
ORDER BY title`

	found := func(term string) []string {
		rows, err := connection.QueryContext(t.Context(), search, term)
		require.NoError(t, err)
		defer func() { assert.NoError(t, rows.Close()) }()

		titles := []string{}
		for rows.Next() {
			var title string
			require.NoError(t, rows.Scan(&title))
			titles = append(titles, title)
		}
		require.NoError(t, rows.Err())

		return titles
	}

	assert.Equal(t, []string{"Pokémon: Índigo"}, found("pokemon"),
		"typing without accents is how most people type, and it has to find the work")
	assert.Equal(t, []string{"Pokémon: Índigo"}, found("POKÉMON"),
		"and so does typing with them, in any case")
	assert.Equal(t, []string{"Pokémon: Índigo"}, found("indigo"),
		"the fold applies to every accented character, not just the first")
	assert.Equal(t, []string{"Terraforming Mars", "Terraforming Mars: Preludio"}, found("terraforming"),
		"a substring match, not a prefix one")

	assert.Equal(t, []string{"100% Teacher"}, found("100%"),
		"a % from the caller is a percent sign, never a wildcard")
	assert.Empty(t, found("100%Teacher"),
		"and if it were a wildcard this would match, which is exactly the bug the escaping prevents")
	assert.Empty(t, found("_"), "the same goes for the single-character wildcard")
}

// The risk the issue names out loud: a Down that drops the tables and forgets
// the enum types leaves a database where the migration can never be applied
// again, and `CREATE TYPE` is the statement that says so. Rolling forward,
// back and forward again is the only way to find out.
func TestLibraryMigrationRollsBackIncludingItsEnumTypes(t *testing.T) {
	connection := migrationsDB(t)
	seedLibrary(t, connection)

	exists := func(query, name string) bool {
		var found bool
		require.NoError(t, connection.QueryRowContext(t.Context(), query, name).Scan(&found))

		return found
	}

	const (
		tableExists = `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = $1)`
		typeExists  = `SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = $1)`
	)

	require.True(t, exists(tableExists, "works"))
	require.True(t, exists(tableExists, "library_entries"))

	require.NoError(t, goose.DownToContext(t.Context(), connection, "migrations", versionBeforeLibrary))

	assert.False(t, exists(tableExists, "library_entries"), "the Down must drop the table")
	assert.False(t, exists(tableExists, "works"), "the Down must drop the table")
	for _, enum := range []string{"work_category", "work_source", "library_status"} {
		assert.Falsef(t, exists(typeExists, enum), "the Down must drop the %s type too", enum)
	}

	assert.True(t, exists(typeExists, "invitation_status"), "and must not touch a type it did not create")

	require.NoError(t, goose.UpToContext(t.Context(), connection, "migrations", versionLibrary),
		"re-applying is what proves the Down left nothing behind")
	assert.True(t, exists(tableExists, "library_entries"))
}

// ADR-0011 only works if the index serves the whole ORDER BY. With three rows
// Postgres will always pick a sequential scan, so seqscan is turned off to ask
// the planner a different question: given the choice, can this index answer the
// keyset without sorting? A missing id tiebreak or a wrong column order shows
// up here as a Sort node.
func TestTheLibraryKeysetWalksItsIndex(t *testing.T) {
	connection := migrationsDB(t)
	seedLibrary(t, connection)

	_, err := connection.ExecContext(t.Context(), `SET enable_seqscan = off`)
	require.NoError(t, err)

	plan := func(query string) string {
		rows, err := connection.QueryContext(t.Context(), "EXPLAIN "+query)
		require.NoError(t, err)
		defer func() { assert.NoError(t, rows.Close()) }()

		var explained strings.Builder
		for rows.Next() {
			var line string
			require.NoError(t, rows.Scan(&line))
			explained.WriteString(line + "\n")
		}
		require.NoError(t, rows.Err())

		return explained.String()
	}

	t.Run("the caller's own library, newest first", func(t *testing.T) {
		explained := plan(`
SELECT * FROM library_entries
WHERE member_id = '` + memberID + `'
  AND (created_at, id) < (now(), '` + importedWork + `')
ORDER BY created_at DESC, id DESC
LIMIT 26`)

		assert.Contains(t, explained, "library_entries_member_created_idx")
		assert.NotContains(t, explained, "Sort", "the index already delivers the order the keyset walks")
	})

	t.Run("the shared catalogue by category", func(t *testing.T) {
		explained := plan(`
SELECT * FROM works
WHERE category = 'anime'
  AND (created_at, id) < (now(), '` + importedWork + `')
ORDER BY created_at DESC, id DESC
LIMIT 26`)

		assert.Contains(t, explained, "works_category_created_idx")
		assert.NotContains(t, explained, "Sort")
	})

	t.Run("the title search", func(t *testing.T) {
		explained := plan(`
SELECT * FROM works
WHERE immutable_unaccent(lower(title)) LIKE '%pokemon%'`)

		assert.Contains(t, explained, "works_title_search_idx",
			"a GIN trigram index is the only thing that answers a substring match without reading every row")
	})

	t.Run("filtering the library by status", func(t *testing.T) {
		explained := plan(`SELECT * FROM library_entries WHERE member_id = '` + memberID + `' AND status = 'in_progress'`)

		assert.Contains(t, explained, "library_entries_member_status_idx")
	})
}
