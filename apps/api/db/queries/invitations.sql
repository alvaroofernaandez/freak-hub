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
