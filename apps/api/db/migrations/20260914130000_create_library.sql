-- +goose Up
-- +goose StatementBegin

-- The first tables of the domain proper. domain.md settles the modelling: a
-- work is one objective record shared by the whole group, and a library entry
-- is one person's relationship with it. Two members watching the same anime
-- point at the same work, which is what later makes matches and
-- recommendations mean anything; a table per category, or one wide table of
-- mostly-null columns, would both throw that away.

-- Domain enums are Postgres types here, never text with a CHECK, the same way
-- invitation_status already is. The type is declared once and every column,
-- function and generated Go signature inherits it, instead of each table
-- restating a list that drifts.
CREATE TYPE work_category AS ENUM ('anime', 'manga', 'game', 'film', 'boardgame', 'tcg');

-- Where the record came from. `manual` is a first-class value, not a fallback:
-- a homemade deck or an obscure game has to be recordable too (catalogs.md).
CREATE TYPE work_source AS ENUM ('anilist', 'tmdb', 'igdb', 'bgg', 'scryfall', 'manual');

-- All six values are valid when an entry is *created*: registering something
-- you finished years ago is ordinary. The state machine in domain.md restricts
-- transitions, and transitions are a service concern.
CREATE TYPE library_status AS ENUM ('wishlist', 'pending', 'in_progress', 'completed', 'dropped', 'on_hold');

-- The objective record of a thing, shared by everybody.
CREATE TABLE works (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title        text          NOT NULL,
    category     work_category NOT NULL,
    source       work_source   NOT NULL,
    -- The work's id inside its own catalogue. NULL exactly when source is
    -- 'manual', because there is no external record to point at.
    source_id    text,
    cover_url    text,
    synopsis     text,
    year         int,
    -- Everything specific to one category — episodes, players, set code — kept
    -- out of columns that would be null for the other five. The rule from
    -- domain.md: shared by every category means a column, belongs to one means
    -- it lives here. NOT NULL with a default so reading it never needs a null
    -- check; an empty object is the honest answer for a work nobody enriched.
    metadata     jsonb         NOT NULL DEFAULT '{}',
    -- A board game expansion is a work of its own — its own record, its own
    -- library entry — linked to its base instead of floating loose in the
    -- catalogue (ADR-0006). RESTRICT because an expansion pointing at nothing
    -- is worse than no expansion.
    expansion_of uuid          REFERENCES works (id) ON DELETE RESTRICT,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now()
);

-- One member's relationship with one work: what turns a shared catalogue into
-- *your* library.
CREATE TABLE library_entries (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Domain rule 4: leaving the group takes your entries with you.
    member_id    uuid           NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    -- Domain rule 3: a work is never deleted, even when nobody keeps it any
    -- more. It is shared history, so the reference restricts instead.
    work_id      uuid           NOT NULL REFERENCES works (id) ON DELETE RESTRICT,
    status       library_status NOT NULL,
    -- The unit depends on the category — episodes, chapters, hours, plays — so
    -- the domain validates the magnitude (rule 5). The database owns only what
    -- is true for every category: progress does not run backwards.
    progress     int            NOT NULL DEFAULT 0 CHECK (progress >= 0),
    -- 1..10 is a structural invariant of the scale and belongs here. That a
    -- rating only makes sense on 'completed' or 'dropped' (rule 2) deliberately
    -- does NOT: it is a product rule about the request that carries a rating,
    -- a stored rating survives a later status change, and freezing either half
    -- of that into a CHECK would couple the schema to a rule that can move.
    rating       int            CHECK (rating BETWEEN 1 AND 10),
    -- Affection, not score. A favourite rated 6 is a perfectly normal thing.
    is_favourite boolean        NOT NULL DEFAULT false,
    -- Whether there is a physical copy. Matters for board games, manga and TCG.
    owned        boolean        NOT NULL DEFAULT false,
    -- Public to the whole group, with no per-entry privacy setting (ADR-0005).
    note         text,
    started_at   timestamptz,
    finished_at  timestamptz,
    created_at   timestamptz    NOT NULL DEFAULT now(),
    updated_at   timestamptz    NOT NULL DEFAULT now()
);

-- Domain rule 1: at most one entry per member and work. Watching something
-- again is progress on the row that exists, not a second row. This has to be
-- an index and not a Go check, because two requests arriving together would
-- both read "not there" and both insert.
CREATE UNIQUE INDEX library_entries_member_work_idx
    ON library_entries (member_id, work_id);

-- An imported work is unique by (source, source_id), so two members importing
-- the same anime land on the same record. Manual works are deliberately left
-- out: their source_id is NULL, the partial index does not see them, and two
-- people may legitimately add different things under the same title. The
-- search step is what prevents an accidental duplicate, not a constraint that
-- would reject honest entries.
CREATE UNIQUE INDEX works_source_idx
    ON works (source, source_id)
    WHERE source_id IS NOT NULL;

-- The keyset of ADR-0011, and the reason it insists on the id tiebreak:
-- created_at alone is not unique, so a page boundary falling between two rows
-- sharing a timestamp would skip one or repeat it. This is the index
-- GET /v1/library walks, page after page, at constant cost.
CREATE INDEX library_entries_member_created_idx
    ON library_entries (member_id, created_at DESC, id DESC);

-- Filtering your own library by status, which is also how the wishlist is
-- read: it is not a separate list, it is status = 'wishlist'.
CREATE INDEX library_entries_member_status_idx
    ON library_entries (member_id, status);

-- The shared catalogue browsed by category, with the same keyset order as
-- everything else that lists.
CREATE INDEX works_category_created_idx
    ON works (category, created_at DESC, id DESC);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Reverse order, and the enum types included. A Down that drops the tables and
-- leaves the types behind looks like it worked and then makes the Up
-- unrepeatable: CREATE TYPE fails on the second attempt, which is the worst
-- moment to find out. Dropping the tables takes their indexes with them.
DROP TABLE IF EXISTS library_entries;
DROP TABLE IF EXISTS works;
DROP TYPE IF EXISTS library_status;
DROP TYPE IF EXISTS work_source;
DROP TYPE IF EXISTS work_category;

-- +goose StatementEnd
