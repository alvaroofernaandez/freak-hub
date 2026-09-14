-- name: WorkByID :one
SELECT * FROM works WHERE id = $1;

-- name: CreateWork :one
-- Manual entry only, and the query is where that is enforced rather than in a
-- handler: `source` and `source_id` are written here, not taken from the
-- caller, so nothing can claim a record came from AniList when nobody checked.
-- A manual work has no external record to point at, so source_id stays NULL,
-- which is also what keeps it out of works_source_idx: manual works are
-- deliberately not deduplicated.
INSERT INTO works (title, category, source, source_id, cover_url, synopsis, year, metadata)
VALUES (
    sqlc.arg(title)::text,
    sqlc.arg(category)::work_category,
    'manual',
    NULL,
    sqlc.narg(cover_url)::text,
    sqlc.narg(synopsis)::text,
    sqlc.narg(year)::int,
    sqlc.arg(metadata)::jsonb
)
RETURNING *;

-- name: ListWorks :many
-- A page of the shared catalogue, newest first, keyset-paginated
-- (ADR-0011: docs/decisions/0011-paginacion-por-cursor.md). Pass a NULL
-- after_created_at to fetch the first page. Both filters are optional and
-- combine with an AND; a NULL means "do not filter", never "match nothing".
--
-- works_category_created_idx serves the category filter and the whole ORDER BY
-- at once, which is why the index carries the id tiebreak the keyset needs.
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
-- sign rather than writing a wildcard. Order matters in that nesting —
-- backslash first, or the escapes the other two introduce get escaped again.
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
