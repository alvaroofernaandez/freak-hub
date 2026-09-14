-- name: WorkByID :one
SELECT * FROM works WHERE id = $1;

-- name: CreateWork :one
-- Every column the domain fills, `source` and `source_id` included. They are
-- NOT stamped here: library.Service.CreateManualWork is what refuses to take
-- them from a caller, and it is the only way into this today. Freezing
-- 'manual' into the SQL instead would make the importer — the whole reason
-- (source, source_id) is unique — impossible to write against this port.
--
-- source_id arrives NULL exactly when the work is manual, which is what
-- works_source_id_matches_source checks and what keeps manual works out of the
-- partial works_source_idx: they are deliberately not deduplicated.
INSERT INTO works (title, category, source, source_id, cover_url, synopsis, year, metadata, expansion_of)
VALUES (
    sqlc.arg(title)::text,
    sqlc.arg(category)::work_category,
    sqlc.arg(source)::work_source,
    sqlc.narg(source_id)::text,
    sqlc.narg(cover_url)::text,
    sqlc.narg(synopsis)::text,
    sqlc.narg(year)::int,
    -- COALESCE, not a bare argument: the contract makes metadata optional on
    -- CreateWorkRequest, and a required jsonb parameter would send Go's nil as
    -- SQL NULL and hit the NOT NULL constraint. A POST that simply omits the
    -- field has to land on the column's own '{}' default, not on a 500.
    --
    -- It catches SQL NULL and only SQL NULL. The jsonb scalar `null` is a
    -- perfectly valid value that satisfies NOT NULL and walks straight past
    -- this, leaving a row where metadata->>'episodes' answers NULL rather than
    -- "no such key". Nothing in SQL can tell the two apart once the bytes have
    -- arrived, so the adapter is what closes that door: an absent or empty
    -- Metadata is sent as SQL NULL, never as the four bytes `null`.
    COALESCE(sqlc.narg(metadata)::jsonb, '{}'),
    sqlc.narg(expansion_of)::uuid
)
RETURNING *;

-- name: WorkBySource :one
-- An imported work resolved by its catalogue coordinates, which is the read an
-- importer does before deciding whether it has anything to insert. It walks
-- works_source_idx, the same partial unique index that refuses the duplicate
-- when two importers race past this check.
--
-- A manual work is unreachable through it by construction: its source_id is
-- NULL and `source_id = NULL` matches nothing, which is the answer we want
-- rather than an accident — two manual works would otherwise collide on a key
-- that means nothing.
SELECT * FROM works
WHERE source = sqlc.arg(source)::work_source
  AND source_id = sqlc.arg(source_id)::text;

-- name: ListWorks :many
-- A page of the shared catalogue, newest first, keyset-paginated
-- (ADR-0011: docs/decisions/0011-paginacion-por-cursor.md). Pass a NULL
-- after_created_at to fetch the first page. Both filters are optional and
-- combine with an AND; a NULL means "do not filter", never "match nothing".
--
-- works_category_created_idx serves the category filter and the whole ORDER BY
-- at once, which is why the index carries the id tiebreak the keyset needs.
-- That holds for a custom plan: under a generic one the NULL guard blocks the
-- row-comparison pushdown and Postgres sorts the partition instead, and the
-- cost then grows with depth. Harmless at this size, but do not copy this
-- comment elsewhere as a guarantee.
--
-- The title search folds case and accents, so "pokemon" finds "Pokémon"
-- (ADR-0015). Both sides go through immutable_unaccent(lower(...)), and the
-- left-hand side is spelled exactly as works_title_search_idx indexes it,
-- which is what lets the planner use the index instead of reading every row.
--
-- LIKE rather than strpos, and this is the one place the query is not the
-- obvious shape. A GIN trigram index only answers LIKE, ILIKE and the regex
-- operators; strpos is invisible to it, so a strpos search would be correct
-- and would scan the whole catalogue forever. The property strpos was
-- protecting is kept by escaping instead: the term arrives from a query
-- string, so a backslash, a % and a _ are turned into literals before they
-- reach the pattern, and somebody searching for "100%" searches for a percent
-- sign rather than writing a wildcard.
--
-- Two orderings hold this up, and only one of them is visible at a glance:
--
--   1. The escaping WRAPS the folding — immutable_unaccent runs on the inside,
--      the replaces on the outside. It has to be this way round because
--      unaccent emits wildcards of its own: full-width ％ (U+FF05) folds to %,
--      U+FF3C folds to a backslash, U+FF3F to an underscore. Escape first and
--      fold second and the fold manufactures a live wildcard out of a term
--      that had none — a wildcard injection that no ASCII test would catch.
--   2. Inside the escaping, backslash first, or the escapes that the other two
--      replaces introduce get escaped all over again.
SELECT * FROM works
WHERE (sqlc.narg(category)::work_category IS NULL OR category = sqlc.narg(category)::work_category)
  AND (
    sqlc.narg(search)::text IS NULL
    OR immutable_unaccent(lower(title)) LIKE
       '%' || replace(replace(replace(
           immutable_unaccent(lower(sqlc.narg(search)::text)),
       '\', '\\'), '%', '\%'), '_', '\_') || '%'
  )
  AND (
    sqlc.narg(after_created_at)::timestamptz IS NULL
    OR (created_at, id) < (sqlc.narg(after_created_at)::timestamptz, sqlc.narg(after_id)::uuid)
  )
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_limit)::int;
