package library_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library/librarymem"
)

// The double is not a convenience: it is the shape of the schema, expressed
// in Go. Every uniqueness Postgres will hold has to hold here too, or the
// handlers get to discover it in production instead of in a test.

// TestTheInMemoryLibraryRefusesASecondEntryForTheSameMemberAndWork is domain
// rule 1 at the storage layer, where the real unique index over
// (member_id, work_id) will live.
//
// Without it the service's own check-then-act window is invisible: two
// interleaved requests both pass ByMemberAndWork, both Create, and the
// second one only fails in production, as a raw 23505 that no domain error
// maps — a 500 where the answer should be 409 already_in_library.
func TestTheInMemoryLibraryRefusesASecondEntryForTheSameMemberAndWork(t *testing.T) {
	t.Parallel()

	works := librarymem.NewWorkRepository()
	entries := librarymem.NewEntryRepository(works)
	member, work := uuid.New(), uuid.New()

	_, err := entries.Create(context.Background(), library.Entry{MemberID: member, WorkID: work})
	require.NoError(t, err)

	_, err = entries.Create(context.Background(), library.Entry{MemberID: member, WorkID: work})
	require.ErrorIs(t, err, library.ErrAlreadyInLibrary)
}

func TestTheInMemoryLibraryLetsTwoMembersKeepTheSameWork(t *testing.T) {
	t.Parallel()

	works := librarymem.NewWorkRepository()
	entries := librarymem.NewEntryRepository(works)
	work := uuid.New()

	_, err := entries.Create(context.Background(), library.Entry{MemberID: uuid.New(), WorkID: work})
	require.NoError(t, err)

	_, err = entries.Create(context.Background(), library.Entry{MemberID: uuid.New(), WorkID: work})
	require.NoError(t, err, "the index is over the pair, not over the work")
}

func TestTheInMemoryLibraryFreesThePairWhenTheEntryIsDeleted(t *testing.T) {
	t.Parallel()

	works := librarymem.NewWorkRepository()
	entries := librarymem.NewEntryRepository(works)
	member, work := uuid.New(), uuid.New()

	created, err := entries.Create(context.Background(), library.Entry{MemberID: member, WorkID: work})
	require.NoError(t, err)
	require.NoError(t, entries.Delete(context.Background(), created.ID))

	_, err = entries.Create(context.Background(), library.Entry{MemberID: member, WorkID: work})
	require.NoError(t, err, "removing something and adding it back is ordinary")
}

// TestTheInMemoryCatalogueRefusesASecondImportOfTheSameSourceRecord is the
// other unique index: imported works are unique by (source, source_id), which
// is what makes two members importing the same anime land on one row.
func TestTheInMemoryCatalogueRefusesASecondImportOfTheSameSourceRecord(t *testing.T) {
	t.Parallel()

	works := librarymem.NewWorkRepository()
	imported := library.Work{
		Title:    "Frieren",
		Category: library.CategoryAnime,
		Source:   library.SourceAniList,
		SourceID: "154587",
	}

	_, err := works.Create(context.Background(), imported)
	require.NoError(t, err)

	_, err = works.Create(context.Background(), imported)
	require.ErrorIs(t, err, library.ErrWorkAlreadyImported)
}

// TestTheInMemoryCatalogueDoesNotDeduplicateManualWorks keeps the index
// partial, exactly as the contract describes it: a manual work has no source
// id, and two people can legitimately add different things under one title.
func TestTheInMemoryCatalogueDoesNotDeduplicateManualWorks(t *testing.T) {
	t.Parallel()

	works := librarymem.NewWorkRepository()
	typed := library.Work{Title: "Una cosa", Category: library.CategoryAnime, Source: library.SourceManual}

	first, err := works.Create(context.Background(), typed)
	require.NoError(t, err)

	second, err := works.Create(context.Background(), typed)
	require.NoError(t, err, "there is no key to collide on, and the defence is searching before creating")
	assert.NotEqual(t, first.ID, second.ID)
}

func TestTheInMemoryCatalogueSeparatesTheSameIdInDifferentCatalogues(t *testing.T) {
	t.Parallel()

	works := librarymem.NewWorkRepository()

	_, err := works.Create(context.Background(), library.Work{
		Title: "Frieren", Category: library.CategoryAnime, Source: library.SourceAniList, SourceID: "1",
	})
	require.NoError(t, err)

	_, err = works.Create(context.Background(), library.Work{
		Title: "Otra cosa", Category: library.CategoryFilm, Source: library.SourceTMDB, SourceID: "1",
	})
	require.NoError(t, err, "the key is the pair, and catalogues number their records independently")
}
