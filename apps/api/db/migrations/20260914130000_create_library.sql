-- +goose Up
-- +goose StatementBegin

-- The first tables of the domain proper. domain.md settles the modelling: a
-- work is one objective record shared by the whole group, and a library entry
-- is one person's relationship with it. Two members watching the same anime
-- point at the same work, which is what later makes matches and
-- recommendations mean anything; a table per category, or one wide table of
-- mostly-null columns, would both throw that away.

-- The contract promises that the title search of GET /v1/works?q= is case- AND
-- accent-insensitive, which in a Spanish-speaking product is not a detail:
-- somebody typing "pokemon" has to find "Pokémon". Folding accents needs
-- contrib, so from here on this schema depends on two extensions and
-- production has to have them available. That dependency is the decision
-- recorded in ADR-0015 (docs/decisions/0015-busqueda-sin-acentos.md).
--
-- unaccent folds the accents; pg_trgm is what makes the result searchable by
-- substring, because no B-tree can answer "contains" — only "starts with".
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() cannot be indexed: it is declared STABLE, not IMMUTABLE, because
-- it reads a dictionary that could be changed underneath it, and Postgres
-- refuses to build an index on a function whose answer it cannot assume is
-- fixed. This wrapper is the documented way around it — it pins the dictionary
-- explicitly instead of resolving it through the search path at call time, and
-- then promises IMMUTABLE.
--
-- It looks redundant and it is not: delete it and works_title_search_idx stops
-- being creatable. The promise has one real condition attached — if the
-- unaccent rules file is ever edited, every index built on this function has
-- to be REINDEXed, because Postgres will keep trusting entries computed under
-- the old rules.
CREATE FUNCTION immutable_unaccent(input text) RETURNS text
    LANGUAGE sql
    IMMUTABLE
    PARALLEL SAFE
    STRICT
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, input) $$;

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

-- The free-text title search, folded to lower case and stripped of accents so
-- "pokemon", "Pokemon" and "Pokémon" all land on the same entry. GIN over
-- trigrams rather than a B-tree because the search is a substring match, and a
-- B-tree can only answer a prefix: `LIKE 'poke%'` it could serve, `LIKE
-- '%poke%'` it could not. The expression is indexed, so the query has to spell
-- it the same way for the planner to recognise it.
CREATE INDEX works_title_search_idx
    ON works USING gin (immutable_unaccent(lower(title)) gin_trgm_ops);

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

-- The function goes after the table, because works_title_search_idx depends on
-- it and dropping the table is what takes the index with it.
DROP FUNCTION IF EXISTS immutable_unaccent(text);

-- And the extensions go last, deliberately, with two choices worth stating.
--
-- No CASCADE. If something outside this migration ever comes to depend on
-- unaccent or pg_trgm, this DROP refuses and the rollback fails loudly instead
-- of quietly taking that something down with it. Failing loudly is the rule
-- here, and a rollback that silently breaks an unrelated index is the exact
-- opposite of one.
--
-- They are dropped at all because the Up created them and a Down owes back
-- what its Up took — leaving them behind would mean a rolled-back database
-- still carrying objects no migration declares. The asymmetry to know about:
-- CREATE EXTENSION IF NOT EXISTS succeeds on a database where somebody had
-- already installed unaccent by hand, and this DROP would then remove
-- something this migration never created. Same class of knowingly destructive
-- Down as the backfill above it, and recorded the same way in data-model.md.
DROP EXTENSION IF EXISTS pg_trgm;
DROP EXTENSION IF EXISTS unaccent;

-- +goose StatementEnd
