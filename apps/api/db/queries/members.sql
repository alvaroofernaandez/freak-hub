-- name: MemberByClerkID :one
SELECT * FROM members WHERE clerk_user_id = $1;

-- name: MemberByID :one
SELECT * FROM members WHERE id = $1;

-- name: MemberExistsByEmail :one
SELECT EXISTS (
    SELECT 1 FROM members WHERE lower(email) = lower(sqlc.arg(email)::text)
) AS member_exists;

-- name: UpsertMember :one
-- Keyed by clerk_user_id so a redelivered webhook refreshes the profile instead
-- of creating a second member.
INSERT INTO members (clerk_user_id, username, display_name, avatar_url, email, invited_by)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (clerk_user_id) DO UPDATE
SET username     = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    avatar_url   = EXCLUDED.avatar_url,
    email        = EXCLUDED.email,
    updated_at   = now()
RETURNING *;

-- name: DeleteMemberByClerkID :exec
DELETE FROM members WHERE clerk_user_id = $1;
