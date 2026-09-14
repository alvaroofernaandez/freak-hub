-- +goose Up
-- +goose StatementBegin

-- ADR-0011 fixes the keyset order as (created_at DESC, id DESC): created_at
-- alone is not unique, so a page boundary falling between two rows that share
-- a timestamp would skip one or repeat it. invitations_inviter_idx stopped at
-- created_at, leaving that tiebreak unindexed, so recreate it with id.
DROP INDEX IF EXISTS invitations_inviter_idx;

CREATE INDEX invitations_inviter_idx
    ON invitations (inviter_id, created_at DESC, id DESC);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Back to the index 20260831000001_init.sql created: no id tiebreak.
DROP INDEX IF EXISTS invitations_inviter_idx;

CREATE INDEX invitations_inviter_idx
    ON invitations (inviter_id, created_at DESC);

-- +goose StatementEnd
