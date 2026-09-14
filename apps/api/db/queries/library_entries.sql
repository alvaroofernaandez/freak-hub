-- name: LibraryEntryByID :one
-- Scoped by member on purpose: an entry that belongs to somebody else is not a
-- 403 for this API, it is a 404. The caller has no business knowing it exists.
-- The work travels with it so rendering never needs a second round trip.
SELECT sqlc.embed(le), sqlc.embed(w)
FROM library_entries le
JOIN works w ON w.id = le.work_id
WHERE le.id = sqlc.arg(id)::uuid
  AND le.member_id = sqlc.arg(member_id)::uuid;

-- name: LibraryEntryByMemberAndWork :one
-- The read behind `409 already_in_library`. It is a convenience, not the
-- guarantee: two concurrent requests both read "not there" and both insert, so
-- what actually holds domain rule 1 is library_entries_member_work_idx. Treat
-- the unique violation as the real answer and this as the fast path.
SELECT * FROM library_entries
WHERE member_id = sqlc.arg(member_id)::uuid
  AND work_id = sqlc.arg(work_id)::uuid;

-- name: ListLibraryEntries :many
-- The caller's own library, newest first, keyset-paginated
-- (ADR-0011: docs/decisions/0011-paginacion-por-cursor.md). Pass a NULL
-- after_created_at to fetch the first page. There is no separate wishlist
-- query because the wishlist is not a separate thing: it is status='wishlist'
-- arriving through this same filter.
--
-- Unfiltered, the keyset walks library_entries_member_created_idx, which
-- delivers (member_id, created_at DESC, id DESC) already ordered. With a
-- status filter it walks library_entries_member_status_idx, which carries the
-- same two ordering columns after (member_id, status) for exactly that reason:
-- without them the planner ignored it entirely and filtered on top of the
-- other index instead. The category filter reaches across the join into works,
-- so it is applied there rather than pushed into either entry index.
--
-- All of that holds for a custom plan: under a generic one the NULL guard
-- blocks the row-comparison pushdown and Postgres sorts the partition instead,
-- and the cost then grows with depth. Harmless at this size, but do not copy
-- this comment elsewhere as a guarantee.
SELECT sqlc.embed(le), sqlc.embed(w)
FROM library_entries le
JOIN works w ON w.id = le.work_id
WHERE le.member_id = sqlc.arg(member_id)::uuid
  AND (sqlc.narg(status)::library_status IS NULL OR le.status = sqlc.narg(status)::library_status)
  AND (sqlc.narg(category)::work_category IS NULL OR w.category = sqlc.narg(category)::work_category)
  AND (
    sqlc.narg(after_created_at)::timestamptz IS NULL
    OR (le.created_at, le.id) < (sqlc.narg(after_created_at)::timestamptz, sqlc.narg(after_id)::uuid)
  )
ORDER BY le.created_at DESC, le.id DESC
LIMIT sqlc.arg(page_limit)::int;

-- name: CreateLibraryEntry :one
-- Any of the six statuses is accepted: creating an entry is the entry point
-- into the lifecycle, not a transition, so registering something you finished
-- years ago does not have to travel through 'pending' first. The state machine
-- constrains what comes after, and it lives in the service.
INSERT INTO library_entries (
    member_id, work_id, status, progress, rating, is_favourite, owned, note, started_at, finished_at
)
VALUES (
    sqlc.arg(member_id)::uuid,
    sqlc.arg(work_id)::uuid,
    sqlc.arg(status)::library_status,
    sqlc.arg(progress)::int,
    sqlc.narg(rating)::int,
    sqlc.arg(is_favourite)::boolean,
    sqlc.arg(owned)::boolean,
    sqlc.narg(note)::text,
    sqlc.narg(started_at)::timestamptz,
    sqlc.narg(finished_at)::timestamptz
)
RETURNING *;

-- name: UpdateLibraryEntry :one
-- Every mutable column is written, so the service reads the entry, merges the
-- patch and hands back the whole row. A COALESCE-per-column query cannot do
-- this job: the contract distinguishes an absent property ("leave it") from an
-- explicit null ("clear it"), and COALESCE collapses both into "leave it",
-- which would make clearing a rating or a note impossible.
--
-- work_id is absent by design: an entry never changes the work it points at.
-- Scoped by member for the same reason the read is.
UPDATE library_entries
SET status       = sqlc.arg(status)::library_status,
    progress     = sqlc.arg(progress)::int,
    rating       = sqlc.narg(rating)::int,
    is_favourite = sqlc.arg(is_favourite)::boolean,
    owned        = sqlc.arg(owned)::boolean,
    note         = sqlc.narg(note)::text,
    started_at   = sqlc.narg(started_at)::timestamptz,
    finished_at  = sqlc.narg(finished_at)::timestamptz,
    updated_at   = now()
WHERE id = sqlc.arg(id)::uuid
  AND member_id = sqlc.arg(member_id)::uuid
RETURNING *;

-- name: DeleteLibraryEntry :execrows
-- Returns the number of rows removed so the handler can answer 404 on the
-- second attempt instead of pretending a delete happened. The work itself is
-- untouched: domain rule 3, it is shared history.
DELETE FROM library_entries
WHERE id = sqlc.arg(id)::uuid
  AND member_id = sqlc.arg(member_id)::uuid;
