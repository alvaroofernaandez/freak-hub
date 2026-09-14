-- +goose Up
-- +goose StatementBegin

-- members.invited_by has existed since the initial migration and was never
-- written: the webhook closed the invitation after projecting the member, so
-- the inviter it had just read was thrown away, and the upsert deliberately
-- never touches the column on conflict. Every member who joined before this
-- migration therefore looks like a founder.
--
-- The data is recoverable because invitations keeps email and inviter_id for
-- every invitation it ever accepted. Match on lower(email), the same key the
-- webhook uses, and only fill rows that are still empty so this never
-- overwrites an inviter the fixed code path recorded.
--
-- One address can hold more than one accepted invitation: user.deleted removes
-- the member and leaves its invitations behind, after which nothing stops a
-- second invitation to the same address (invitations_pending_email_idx only
-- constrains pending rows). A plain UPDATE … FROM would then pick an arbitrary
-- matching row — whichever the join reaches first — so the same migration
-- could write different answers on two databases holding the same data.
-- DISTINCT ON collapses each address to exactly one invitation first: the most
-- recently accepted, tie-broken by id so the result never depends on physical
-- row order.
--
-- i.inviter_id <> m.id guards against a self-link: a member recorded as their
-- own inviter is nonsense, and members.invited_by is a foreign key back into
-- the same table, so a self-reference would survive every constraint and
-- quietly corrupt the invitation tree. When the winning invitation is a
-- self-link the member simply keeps its honest NULL.
UPDATE members m
SET    invited_by = chosen.inviter_id
FROM  (
    SELECT DISTINCT ON (lower(i.email))
           lower(i.email) AS email,
           i.inviter_id   AS inviter_id
    FROM   invitations i
    WHERE  i.status = 'accepted'
    ORDER  BY lower(i.email), i.accepted_at DESC NULLS LAST, i.id
) AS chosen
WHERE  chosen.email = lower(m.email)
  AND  m.invited_by IS NULL
  AND  chosen.inviter_id <> m.id;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Clears exactly the rows the Up statement could have written: a member whose
-- invited_by still matches the invitation this migration would pick for their
-- address. Rows pointing anywhere else were not written here and are left
-- alone.
--
-- Destructive on a live database, and knowingly so: it cannot tell a value the
-- backfill wrote from an identical one the webhook wrote afterwards, so it
-- gives up both. Re-applying the Up statement restores them from invitations,
-- which is the same source it read the first time.
UPDATE members m
SET    invited_by = NULL
FROM  (
    SELECT DISTINCT ON (lower(i.email))
           lower(i.email) AS email,
           i.inviter_id   AS inviter_id
    FROM   invitations i
    WHERE  i.status = 'accepted'
    ORDER  BY lower(i.email), i.accepted_at DESC NULLS LAST, i.id
) AS chosen
WHERE  chosen.email = lower(m.email)
  AND  m.invited_by = chosen.inviter_id
  AND  chosen.inviter_id <> m.id;

-- +goose StatementEnd
