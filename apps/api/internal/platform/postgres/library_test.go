package postgres_test

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/postgres"
)

// The clock the seeds are pinned to. Listing order is the whole subject of
// several of these tests, and wall-clock timestamps would make it a race.
var (
	newest = time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
	middle = newest.Add(-time.Hour)
	oldest = newest.Add(-2 * time.Hour)
)

// TestTheAdaptersImplementTheLibraryPorts is a compile-time check, which is
// why it needs no database and is the one test here that runs in parallel: a
// method whose signature drifts from the port stops the build rather than
// failing at boot, where the composition root would be the one to notice.
func TestTheAdaptersImplementTheLibraryPorts(t *testing.T) {
	t.Parallel()

	var works library.WorkRepository = postgres.NewWorkRepository(nil)
	var entries library.EntryRepository = postgres.NewEntryRepository(nil)

	assert.NotNil(t, works)
	assert.NotNil(t, entries)
}

func TestCreateWorkRoundTripsEveryNullableColumn(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)

	year := 2009
	created, err := works.Create(t.Context(), library.Work{
		Title:    "Fullmetal Alchemist: Brotherhood",
		Category: library.CategoryAnime,
		Source:   library.SourceAniList,
		SourceID: "5114",
		CoverURL: "https://example.test/fmab.jpg",
		Synopsis: "Dos hermanos y una ley de intercambio equivalente.",
		Year:     &year,
		Metadata: library.Metadata{library.MetadataKeyEpisodes: 64},
	})
	require.NoError(t, err)

	assert.NotEqual(t, uuid.Nil, created.ID, "the database mints the id")
	assert.False(t, created.CreatedAt.IsZero(), "created_at comes back as a time.Time, never as a pgtype")

	read, err := works.ByID(t.Context(), created.ID)
	require.NoError(t, err)

	assert.Equal(t, "Fullmetal Alchemist: Brotherhood", read.Title)
	assert.Equal(t, library.CategoryAnime, read.Category)
	assert.Equal(t, library.SourceAniList, read.Source)
	assert.Equal(t, "5114", read.SourceID)
	assert.Equal(t, "https://example.test/fmab.jpg", read.CoverURL)
	assert.Equal(t, "Dos hermanos y una ley de intercambio equivalente.", read.Synopsis)
	require.NotNil(t, read.Year)
	assert.Equal(t, 2009, *read.Year)
	assert.Nil(t, read.ExpansionOf)

	total, known := read.Total()
	assert.True(t, known, "an episode count written as a Go int has to come back as a number, not as a string")
	assert.Equal(t, 64, total)
}

// A manual work is the shape where every optional column is absent at once,
// and the one the contract actually creates today.
func TestCreateWorkLeavesTheAbsentColumnsEmptyRatherThanNull(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)

	created, err := works.Create(t.Context(), library.Work{
		Title:    "Un fanzine que no cataloga nadie",
		Category: library.CategoryManga,
		Source:   library.SourceManual,
	})
	require.NoError(t, err)

	read, err := works.ByID(t.Context(), created.ID)
	require.NoError(t, err)

	assert.Empty(t, read.SourceID, "a manual work has no external record to point at")
	assert.Empty(t, read.CoverURL, "a NULL cover comes back as the empty string the domain declares")
	assert.Empty(t, read.Synopsis)
	assert.Nil(t, read.Year)
	assert.Empty(t, read.Metadata, "nobody enriched it, so the honest answer is an empty map")
}

// The jsonb scalar `null` is a valid value that satisfies NOT NULL, so
// `metadata` can end up holding it while every read of `metadata->>'episodes'`
// answers NULL instead of "no such key". COALESCE in the query only catches
// SQL NULL, so the door is closed here: an absent Metadata is sent as SQL NULL
// and lands on the column's own '{}' default.
func TestCreateWorkNeverStoresAJsonbNull(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)

	for name, metadata := range map[string]library.Metadata{
		"absent": nil,
		"empty":  {},
	} {
		t.Run(name, func(t *testing.T) {
			created, err := works.Create(t.Context(), library.Work{
				Title:    "Metadata " + name,
				Category: library.CategoryAnime,
				Source:   library.SourceManual,
				Metadata: metadata,
			})
			require.NoError(t, err)

			var kind string
			require.NoError(t, pool.QueryRow(t.Context(),
				`SELECT jsonb_typeof(metadata) FROM works WHERE id = $1`, created.ID).Scan(&kind))
			assert.Equal(t, "object", kind,
				"a jsonb null would satisfy NOT NULL and make every metadata key read as NULL")
		})
	}
}

func TestCreateWorkRefusesACatalogueRecordAlreadyImported(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)

	imported := library.Work{
		Title:    "Fullmetal Alchemist: Brotherhood",
		Category: library.CategoryAnime,
		Source:   library.SourceAniList,
		SourceID: "5114",
	}

	_, err := works.Create(t.Context(), imported)
	require.NoError(t, err)

	imported.Title = "FMA:B otra vez"
	_, err = works.Create(t.Context(), imported)

	assert.ErrorIs(t, err, library.ErrWorkAlreadyImported,
		"works_source_idx is what makes two members importing the same anime land on one row")
}

func TestCreateWorkAcceptsTwoManualWorksUnderTheSameTitle(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)

	manual := library.Work{
		Title:    "Un fanzine que no cataloga nadie",
		Category: library.CategoryManga,
		Source:   library.SourceManual,
	}

	_, err := works.Create(t.Context(), manual)
	require.NoError(t, err)

	_, err = works.Create(t.Context(), manual)
	assert.NoError(t, err,
		"manual works carry no source id, so the partial unique index does not see them")
}

// The CHECK constraints are the one family of violations that is deliberately
// NOT translated. They fire when a caller composes a Work the domain itself
// declares impossible — an imported work with no external id — so translating
// them into a domain error would answer a client about something it never
// sent and hide the importer bug behind a validation message.
func TestCreateWorkLeavesACheckViolationUntranslated(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)

	_, err := works.Create(t.Context(), library.Work{
		Title:    "Ghost import",
		Category: library.CategoryAnime,
		Source:   library.SourceAniList,
	})

	require.Error(t, err)
	assert.NotErrorIs(t, err, library.ErrWorkAlreadyImported)
	assert.NotErrorIs(t, err, library.ErrWorkNotFound)
	assert.Contains(t, err.Error(), "works_source_id_matches_source",
		"the constraint has to reach the log, because the fix is in the caller")
}

func TestWorkByIDReportsAMissingWorkAsNotFound(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)

	_, err := works.ByID(t.Context(), uuid.New())

	assert.ErrorIs(t, err, library.ErrWorkNotFound)
}

func TestBySourceResolvesAnImportedWorkAndNeverAManualOne(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)

	imported, err := works.Create(t.Context(), library.Work{
		Title:    "Fullmetal Alchemist: Brotherhood",
		Category: library.CategoryAnime,
		Source:   library.SourceAniList,
		SourceID: "5114",
	})
	require.NoError(t, err)

	found, err := works.BySource(t.Context(), library.SourceAniList, "5114")
	require.NoError(t, err)
	assert.Equal(t, imported.ID, found.ID)

	_, err = works.BySource(t.Context(), library.SourceTMDB, "5114")
	assert.ErrorIs(t, err, library.ErrWorkNotFound,
		"the uniqueness is over the pair, so the same id in another catalogue is another work")

	_, err = works.BySource(t.Context(), library.SourceManual, "")
	assert.ErrorIs(t, err, library.ErrWorkNotFound,
		"a manual work has no source id, so two of them would collide on a key that means nothing")
}

func TestSearchWalksTheCatalogueNewestFirstWithoutRepeatingARow(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)

	first := seedWork(t, pool, "Primera", "anime", newest)
	second := seedWork(t, pool, "Segunda", "anime", middle)
	third := seedWork(t, pool, "Tercera", "manga", oldest)

	page, err := works.Search(t.Context(), library.WorkFilter{}, nil, 2)
	require.NoError(t, err)
	require.Len(t, page, 2)
	assert.Equal(t, []uuid.UUID{first, second}, []uuid.UUID{page[0].ID, page[1].ID})

	after := library.Cursor{CreatedAt: page[1].CreatedAt, ID: page[1].ID}
	next, err := works.Search(t.Context(), library.WorkFilter{}, &after, 2)
	require.NoError(t, err)
	require.Len(t, next, 1, "the keyset resumes strictly after the cursor, so nothing repeats")
	assert.Equal(t, third, next[0].ID)

	filtered, err := works.Search(t.Context(), library.WorkFilter{Category: library.CategoryManga}, nil, 10)
	require.NoError(t, err)
	require.Len(t, filtered, 1)
	assert.Equal(t, third, filtered[0].ID)
}

func TestSearchFoldsCaseAndAccentsAndTakesAPercentLiterally(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)

	accented := seedWork(t, pool, "Pokémon: Índigo", "anime", newest)
	percent := seedWork(t, pool, "100% Teacher", "manga", middle)

	found, err := works.Search(t.Context(), library.WorkFilter{Query: "pokemon"}, nil, 10)
	require.NoError(t, err)
	require.Len(t, found, 1, "somebody typing pokemon has to find Pokémon (ADR-0015)")
	assert.Equal(t, accented, found[0].ID)

	literal, err := works.Search(t.Context(), library.WorkFilter{Query: "100%"}, nil, 10)
	require.NoError(t, err)
	require.Len(t, literal, 1, "a percent sign in the term is a character, not a wildcard")
	assert.Equal(t, percent, literal[0].ID)

	wildcard, err := works.Search(t.Context(), library.WorkFilter{Query: "%"}, nil, 10)
	require.NoError(t, err)
	require.Len(t, wildcard, 1,
		"escaped, a lone %% matches only the title that really contains one; "+
			"unescaped it would be a wildcard and match both")
	assert.Equal(t, percent, wildcard[0].ID)
}

func TestCreateEntryRefusesASecondEntryForTheSameWork(t *testing.T) {
	pool := libraryDB(t, nil)
	entries := postgres.NewEntryRepository(pool)

	member := seedMember(t, pool, "alvaro")
	work := seedWork(t, pool, "Fullmetal Alchemist: Brotherhood", "anime", newest)

	entry := library.Entry{MemberID: member, WorkID: work, Status: library.StatusInProgress}

	created, err := entries.Create(t.Context(), entry)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, created.ID)

	entry.Status = library.StatusCompleted
	_, err = entries.Create(t.Context(), entry)

	assert.ErrorIs(t, err, library.ErrAlreadyInLibrary,
		"library_entries_member_work_idx is what holds domain rule 1 against two interleaved requests")
}

func TestCreateEntryReportsAWorkThatIsNotInTheCatalogueAsWorkNotFound(t *testing.T) {
	pool := libraryDB(t, nil)
	entries := postgres.NewEntryRepository(pool)

	member := seedMember(t, pool, "alvaro")

	_, err := entries.Create(t.Context(), library.Entry{
		MemberID: member,
		WorkID:   uuid.New(),
		Status:   library.StatusWishlist,
	})

	assert.ErrorIs(t, err, library.ErrWorkNotFound,
		"the foreign key is the last word on whether a work exists, and it says 404, not 500")
}

func TestAMissingEntryIsNotFoundHoweverItIsLookedUp(t *testing.T) {
	pool := libraryDB(t, nil)
	entries := postgres.NewEntryRepository(pool)

	member := seedMember(t, pool, "alvaro")

	_, err := entries.ByID(t.Context(), uuid.New())
	assert.ErrorIs(t, err, library.ErrEntryNotFound)

	_, err = entries.ByMemberAndWork(t.Context(), member, uuid.New())
	assert.ErrorIs(t, err, library.ErrEntryNotFound)

	err = entries.Delete(t.Context(), uuid.New())
	assert.ErrorIs(t, err, library.ErrEntryNotFound)

	_, err = entries.Update(t.Context(), library.Entry{
		ID: uuid.New(), MemberID: member, WorkID: uuid.New(), Status: library.StatusPending,
	})
	assert.ErrorIs(t, err, library.ErrEntryNotFound)
}

// The N+1 the issue is about, measured rather than argued. Twenty-five entries
// resolved one work at a time would be twenty-six statements; the JOIN makes it
// one, whatever the page size.
func TestListResolvesEveryEntryAndItsWorkInASingleStatement(t *testing.T) {
	counter := &queryCounter{}
	pool := libraryDB(t, counter)
	entries := postgres.NewEntryRepository(pool)

	member := seedMember(t, pool, "alvaro")
	for i := range 25 {
		work := seedWork(t, pool, "Obra", "anime", newest.Add(-time.Duration(i)*time.Minute))
		seedEntry(t, pool, member, work, "in_progress", newest.Add(-time.Duration(i)*time.Minute))
	}

	counter.reset()

	page, err := entries.List(t.Context(), library.EntryFilter{MemberID: member}, nil, 26)
	require.NoError(t, err)
	require.Len(t, page, 25)

	assert.Len(t, counter.recorded(), 1,
		"a page of 25 entries costs one round trip, not twenty-six: sqlc.embed brings the work along")

	for _, row := range page {
		assert.Equal(t, row.WorkID, row.Work.ID, "every entry travels with its own work")
		assert.NotEmpty(t, row.Work.Title)
	}
}

func TestListMapsEveryNullableColumnOntoTheDomain(t *testing.T) {
	pool := libraryDB(t, nil)
	entries := postgres.NewEntryRepository(pool)

	member := seedMember(t, pool, "alvaro")
	work := seedWork(t, pool, "Fullmetal Alchemist: Brotherhood", "anime", newest)

	rating := 9
	note := "Una de las pocas que merece el rewatch."
	started := newest.Add(-72 * time.Hour)
	finished := newest.Add(-24 * time.Hour)

	_, err := entries.Create(t.Context(), library.Entry{
		MemberID:    member,
		WorkID:      work,
		Status:      library.StatusCompleted,
		Progress:    64,
		Rating:      &rating,
		IsFavourite: true,
		Owned:       true,
		Note:        &note,
		StartedAt:   &started,
		FinishedAt:  &finished,
	})
	require.NoError(t, err)

	bare := seedWork(t, pool, "Sin nada", "manga", oldest)
	_, err = entries.Create(t.Context(), library.Entry{
		MemberID: member, WorkID: bare, Status: library.StatusWishlist,
	})
	require.NoError(t, err)

	page, err := entries.List(t.Context(), library.EntryFilter{MemberID: member}, nil, 10)
	require.NoError(t, err)
	require.Len(t, page, 2)

	// Both entries were created in the same instant, so the page order is the
	// id tiebreak's business and not something to assert on here: what each
	// row is is decided by the work it points at.
	byWork := map[uuid.UUID]library.EntryWithWork{}
	for _, row := range page {
		byWork[row.WorkID] = row
	}

	full := byWork[work]
	require.NotNil(t, full.Rating)
	assert.Equal(t, 9, *full.Rating)
	require.NotNil(t, full.Note)
	assert.Equal(t, note, *full.Note)
	require.NotNil(t, full.StartedAt)
	assert.True(t, started.Equal(*full.StartedAt))
	require.NotNil(t, full.FinishedAt)
	assert.True(t, finished.Equal(*full.FinishedAt))
	assert.True(t, full.IsFavourite)
	assert.True(t, full.Owned)
	assert.Equal(t, 64, full.Progress)

	empty := byWork[bare]
	assert.Nil(t, empty.Rating, "an unrated entry has no score, not a zero")
	assert.Nil(t, empty.Note)
	assert.Nil(t, empty.StartedAt)
	assert.Nil(t, empty.FinishedAt)
}

func TestListFiltersByStatusAndByTheCategoryOfTheWork(t *testing.T) {
	pool := libraryDB(t, nil)
	entries := postgres.NewEntryRepository(pool)

	member := seedMember(t, pool, "alvaro")
	other := seedMember(t, pool, "alex")

	anime := seedWork(t, pool, "Un anime", "anime", newest)
	manga := seedWork(t, pool, "Un manga", "manga", middle)

	watching := seedEntry(t, pool, member, anime, "in_progress", newest)
	reading := seedEntry(t, pool, member, manga, "wishlist", middle)
	seedEntry(t, pool, other, anime, "in_progress", oldest)

	byStatus, err := entries.List(t.Context(),
		library.EntryFilter{MemberID: member, Status: library.StatusInProgress}, nil, 10)
	require.NoError(t, err)
	require.Len(t, byStatus, 1)
	assert.Equal(t, watching, byStatus[0].ID)

	byCategory, err := entries.List(t.Context(),
		library.EntryFilter{MemberID: member, Category: library.CategoryManga}, nil, 10)
	require.NoError(t, err)
	require.Len(t, byCategory, 1, "the category lives on the work, so the filter reaches across the join")
	assert.Equal(t, reading, byCategory[0].ID)

	mine, err := entries.List(t.Context(), library.EntryFilter{MemberID: member}, nil, 10)
	require.NoError(t, err)
	assert.Len(t, mine, 2, "somebody else's shelf is never part of the answer")
}

func TestListWalksTheKeysetWithoutRepeatingOrSkippingARow(t *testing.T) {
	pool := libraryDB(t, nil)
	entries := postgres.NewEntryRepository(pool)

	member := seedMember(t, pool, "alvaro")

	// Three entries sharing one timestamp: the case created_at alone cannot
	// page through, and the reason ADR-0011 insists on the id tiebreak.
	var seeded []uuid.UUID
	for i := range 3 {
		work := seedWork(t, pool, "Obra", "anime", newest.Add(-time.Duration(i)*time.Minute))
		seeded = append(seeded, seedEntry(t, pool, member, work, "in_progress", newest))
	}

	var walked []uuid.UUID
	var after *library.Cursor

	for range 3 {
		page, err := entries.List(t.Context(), library.EntryFilter{MemberID: member}, after, 1)
		require.NoError(t, err)
		require.Len(t, page, 1)

		walked = append(walked, page[0].ID)
		after = &library.Cursor{CreatedAt: page[0].CreatedAt, ID: page[0].ID}
	}

	last, err := entries.List(t.Context(), library.EntryFilter{MemberID: member}, after, 1)
	require.NoError(t, err)
	assert.Empty(t, last, "the walk ends instead of looping")

	assert.ElementsMatch(t, seeded, walked, "every row appears exactly once across the pages")
}

func TestUpdateClearsTheFieldsAPatchNulled(t *testing.T) {
	pool := libraryDB(t, nil)
	entries := postgres.NewEntryRepository(pool)

	member := seedMember(t, pool, "alvaro")
	work := seedWork(t, pool, "Fullmetal Alchemist: Brotherhood", "anime", newest)

	rating := 9
	note := "Una nota."
	started := newest.Add(-72 * time.Hour)

	created, err := entries.Create(t.Context(), library.Entry{
		MemberID: member, WorkID: work, Status: library.StatusCompleted,
		Progress: 64, Rating: &rating, Note: &note, StartedAt: &started,
	})
	require.NoError(t, err)

	cleared := created
	cleared.Rating = nil
	cleared.Note = nil
	cleared.StartedAt = nil
	cleared.Status = library.StatusInProgress
	cleared.Progress = 12

	updated, err := entries.Update(t.Context(), cleared)
	require.NoError(t, err)

	assert.Nil(t, updated.Rating, "an explicit null clears the score; COALESCE would have kept it")
	assert.Nil(t, updated.Note)
	assert.Nil(t, updated.StartedAt)
	assert.Equal(t, library.StatusInProgress, updated.Status)
	assert.Equal(t, 12, updated.Progress)
	assert.True(t, created.CreatedAt.Equal(updated.CreatedAt), "created_at never moves")
	assert.True(t, updated.UpdatedAt.After(created.UpdatedAt), "updated_at is what the activity feed reads")
}

func TestDeleteRemovesTheRelationshipAndLeavesTheWorkInTheCatalogue(t *testing.T) {
	pool := libraryDB(t, nil)
	works := postgres.NewWorkRepository(pool)
	entries := postgres.NewEntryRepository(pool)

	member := seedMember(t, pool, "alvaro")
	work := seedWork(t, pool, "Fullmetal Alchemist: Brotherhood", "anime", newest)

	created, err := entries.Create(t.Context(), library.Entry{
		MemberID: member, WorkID: work, Status: library.StatusDropped,
	})
	require.NoError(t, err)

	require.NoError(t, entries.Delete(t.Context(), created.ID))

	_, err = entries.ByID(t.Context(), created.ID)
	assert.ErrorIs(t, err, library.ErrEntryNotFound)

	_, err = works.ByID(t.Context(), work)
	assert.NoError(t, err, "domain rule 3: what leaves is a relationship, never shared history")
}

// The acceptance criterion the issue spells out as "verified with EXPLAIN",
// kept as a test so it is verified on every run against a database with enough
// rows for the planner to have a choice — at a hundred rows it would seq-scan
// whatever the indexes say, and the test would vouch for nothing.
func TestTheLibraryListingWalksItsIndexesInsteadOfSorting(t *testing.T) {
	pool := libraryDB(t, nil)

	member := seedMember(t, pool, "alvaro")
	_, err := pool.Exec(t.Context(), `
INSERT INTO works (title, category, source, created_at, updated_at)
SELECT 'Obra ' || i, 'anime', 'manual', now() - (i || ' seconds')::interval, now()
FROM generate_series(1, 20000) AS i`)
	require.NoError(t, err)

	_, err = pool.Exec(t.Context(), `
INSERT INTO library_entries (member_id, work_id, status, created_at, updated_at)
SELECT $1, w.id,
       (ARRAY['wishlist','in_progress','completed'])[1 + (row_number() OVER (ORDER BY w.id)) % 3]::library_status,
       w.created_at, w.created_at
FROM works w`, member)
	require.NoError(t, err)

	_, err = pool.Exec(t.Context(), `ANALYZE works`)
	require.NoError(t, err)

	_, err = pool.Exec(t.Context(), `ANALYZE library_entries`)
	require.NoError(t, err)

	statement := namedQuery(t, "../../../db/queries/library_entries.sql", "ListLibraryEntries")

	var cursorAt time.Time
	var cursorID uuid.UUID
	require.NoError(t, pool.QueryRow(t.Context(),
		`SELECT created_at, id FROM library_entries
		 ORDER BY created_at DESC, id DESC OFFSET 5000 LIMIT 1`).Scan(&cursorAt, &cursorID))

	t.Run("unfiltered, it walks library_entries_member_created_idx", func(t *testing.T) {
		plan := explain(t, pool, statement, member, nil, nil, cursorAt, cursorID, 26)
		t.Log("\n" + plan)

		assert.Contains(t, plan, "library_entries_member_created_idx")
		assert.NotContains(t, plan, "Seq Scan on library_entries")
		assert.NotContains(t, plan, "Sort Method",
			"the index delivers (member_id, created_at DESC, id DESC) already ordered")
	})

	t.Run("filtered by status, it walks library_entries_member_status_idx", func(t *testing.T) {
		status := "completed"
		plan := explain(t, pool, statement, member, status, nil, cursorAt, cursorID, 26)
		t.Log("\n" + plan)

		assert.Contains(t, plan, "library_entries_member_status_idx",
			"the status index carries the keyset columns so it can serve the ORDER BY too")
		assert.NotContains(t, plan, "Seq Scan on library_entries")
		assert.NotContains(t, plan, "Sort Method")
	})

	t.Run("the catalogue listing walks works_category_created_idx", func(t *testing.T) {
		works := namedQuery(t, "../../../db/queries/works.sql", "ListWorks")
		require.True(t, strings.Contains(works, "$1"), "the query takes parameters")

		var at time.Time
		var id uuid.UUID
		require.NoError(t, pool.QueryRow(t.Context(),
			`SELECT created_at, id FROM works ORDER BY created_at DESC, id DESC OFFSET 5000 LIMIT 1`).
			Scan(&at, &id))

		plan := explain(t, pool, works, "anime", nil, at, id, 26)
		t.Log("\n" + plan)

		assert.Contains(t, plan, "works_category_created_idx")
		assert.NotContains(t, plan, "Seq Scan on works")
		assert.NotContains(t, plan, "Sort Method")
	})
}
