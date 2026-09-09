-- name: PendingInvitationByEmail :one
SELECT * FROM invitations
WHERE lower(email) = lower(sqlc.arg(email)::text)
  AND status = 'pending';

-- name: CreateInvitation :one
INSERT INTO invitations (clerk_invitation_id, email, inviter_id, status)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: InvitationsByInviter :many
SELECT * FROM invitations
WHERE inviter_id = $1
ORDER BY created_at DESC;

-- name: MarkInvitationAccepted :exec
UPDATE invitations
SET status = 'accepted', accepted_at = now()
WHERE lower(email) = lower(sqlc.arg(email)::text)
  AND status = 'pending';

-- name: ListGroupInvitations :many
-- Every invitation the group has ever sent, newest first, keyset-paginated
-- (ADR-0011: docs/decisions/0011-paginacion-por-cursor.md) and joined with
-- the inviting member, so the group can see who invited whom. Pass a NULL
-- after_created_at to fetch the first page.
SELECT
    i.id,
    i.email,
    i.status,
    i.created_at,
    m.id           AS inviter_id,
    m.username     AS inviter_username,
    m.display_name AS inviter_display_name,
    m.avatar_url   AS inviter_avatar_url
FROM invitations i
JOIN members m ON m.id = i.inviter_id
WHERE sqlc.narg(after_created_at)::timestamptz IS NULL
   OR (i.created_at, i.id) < (sqlc.narg(after_created_at)::timestamptz, sqlc.narg(after_id)::uuid)
ORDER BY i.created_at DESC, i.id DESC
LIMIT sqlc.arg(page_limit)::int;
