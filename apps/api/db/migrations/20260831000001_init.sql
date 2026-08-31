-- +goose Up
-- +goose StatementBegin

-- Members are the local projection of a Clerk user. Clerk owns authentication;
-- this table owns everything the rest of the domain points at.
CREATE TABLE members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id   text        NOT NULL UNIQUE,
    username        text        NOT NULL UNIQUE,
    display_name    text        NOT NULL,
    avatar_url      text        NOT NULL DEFAULT '',
    email           text        NOT NULL DEFAULT '',
    -- Who brought this member in. NULL for the founders.
    invited_by      uuid        REFERENCES members (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Emails are matched case-insensitively when closing an invitation.
CREATE UNIQUE INDEX members_email_lower_idx
    ON members (lower(email))
    WHERE email <> '';

CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked');

-- The only door into the community. Clerk actually sends the email; this table
-- records who opened the door for whom.
CREATE TABLE invitations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_invitation_id text              NOT NULL UNIQUE,
    email               text              NOT NULL,
    inviter_id          uuid              NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    status              invitation_status NOT NULL DEFAULT 'pending',
    created_at          timestamptz       NOT NULL DEFAULT now(),
    accepted_at         timestamptz
);

-- At most one pending invitation per address, so two members cannot both invite
-- the same person and produce two tickets.
CREATE UNIQUE INDEX invitations_pending_email_idx
    ON invitations (lower(email))
    WHERE status = 'pending';

CREATE INDEX invitations_inviter_idx ON invitations (inviter_id, created_at DESC);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS invitations;
DROP TYPE IF EXISTS invitation_status;
DROP TABLE IF EXISTS members;
-- +goose StatementEnd
