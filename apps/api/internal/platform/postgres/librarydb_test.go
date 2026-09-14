package postgres_test

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/db"
)

// The adapter tests need a real Postgres, because what they prove is exactly
// what the in-memory double cannot: that the SQL is right, that the indexes
// are used and that a driver error becomes a domain error. They skip without
// TEST_DATABASE_URL so `go test ./...` stays green in the `api` CI job, which
// has no database, and they refuse any database whose name does not end in
// _test because they truncate every table — the same guard db/migrations_test.go
// already uses, for the same reason.
//
// They are also deliberately serial: the catalogue is shared by everybody by
// design, so two parallel tests browsing it would see each other's works. The
// isolation comes from truncating between tests instead, which is why none of
// them calls t.Parallel().

var migrateOnce sync.Once

// libraryDB applies every migration once per run and hands back an empty
// database. tracer is optional: pass one to count the round trips a call makes.
func libraryDB(t *testing.T, tracer pgx.QueryTracer) *pgxpool.Pool {
	t.Helper()

	rawURL := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if rawURL == "" {
		t.Skip(
			"TEST_DATABASE_URL is not set: these tests need a throwaway Postgres " +
				"whose database name ends in _test. They truncate every table, so do " +
				"not point this at the database `pnpm infra:up` starts.",
		)
	}

	requireThrowawayDatabase(t, rawURL)

	adapterURL := ownDatabase(t, rawURL)
	migrateOnce.Do(func() { migrateUp(t, rawURL, adapterURL) })

	config, err := pgxpool.ParseConfig(adapterURL)
	require.NoError(t, err)
	config.ConnConfig.Tracer = tracer

	pool, err := pgxpool.NewWithConfig(t.Context(), config)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	require.NoError(t, pool.Ping(t.Context()))

	_, err = pool.Exec(t.Context(),
		`TRUNCATE library_entries, works, members RESTART IDENTITY CASCADE`)
	require.NoError(t, err)

	return pool
}

// requireThrowawayDatabase fails the run when TEST_DATABASE_URL names anything
// but a database whose name ends in _test.
func requireThrowawayDatabase(t *testing.T, rawURL string) {
	t.Helper()

	parsed, err := url.Parse(rawURL)
	require.NoError(t, err, "TEST_DATABASE_URL must be a valid connection URL")

	name := strings.TrimPrefix(parsed.Path, "/")
	require.Truef(t, strings.HasSuffix(name, "_test"),
		"TEST_DATABASE_URL points at %q, and these tests truncate every table. "+
			"Point them at a throwaway database whose name ends in _test.", name)
}

// ownDatabase is the name these tests use, derived from TEST_DATABASE_URL but
// never equal to it.
//
// db/migrations_test.go and db/library_schema_test.go read the same variable
// and roll every migration back to zero, and `go test ./...` runs packages
// concurrently — so sharing one database would let one package drop the tables
// the other is in the middle of querying. The failure would be intermittent and
// would look like a bug in the adapter, which is the worst kind of false
// accusation to leave lying around. Two databases on the same server cost
// nothing and make the question not arise.
func ownDatabase(t *testing.T, rawURL string) string {
	t.Helper()

	parsed, err := url.Parse(rawURL)
	require.NoError(t, err)

	name := strings.TrimPrefix(parsed.Path, "/")
	parsed.Path = "/" + strings.TrimSuffix(name, "_test") + "_adapter_test"

	return parsed.String()
}

// createDatabase makes the adapter's own database, tolerating the usual case
// where a previous run already did.
func createDatabase(t *testing.T, adminURL, adapterURL string) {
	t.Helper()

	parsed, err := url.Parse(adapterURL)
	require.NoError(t, err)
	name := strings.TrimPrefix(parsed.Path, "/")

	admin, err := sql.Open("pgx", adminURL)
	require.NoError(t, err)
	defer func() { assert.NoError(t, admin.Close()) }()

	// pq_quote is not available here and the name is derived from a URL this
	// process built, so a plain identifier is safe — but keep it obviously so.
	require.Regexp(t, `^[A-Za-z0-9_]+$`, name)

	if _, err := admin.ExecContext(t.Context(), `CREATE DATABASE `+name); err != nil {
		var pgErr *pgconn.PgError
		require.Truef(t, errors.As(err, &pgErr) && pgErr.Code == duplicateDatabase,
			"could not create %s: %v", name, err)
	}
}

// duplicateDatabase is the SQLSTATE for "that database is already there".
const duplicateDatabase = "42P04"

func migrateUp(t *testing.T, adminURL, adapterURL string) {
	t.Helper()

	createDatabase(t, adminURL, adapterURL)

	connection, err := sql.Open("pgx", adapterURL)
	require.NoError(t, err)
	defer func() { assert.NoError(t, connection.Close()) }()

	goose.SetBaseFS(db.Migrations)
	goose.SetLogger(goose.NopLogger())
	require.NoError(t, goose.SetDialect("postgres"))
	require.NoError(t, goose.UpContext(t.Context(), connection, "migrations"))
}

// seedMember inserts one member, which every library entry needs to exist.
func seedMember(t *testing.T, pool *pgxpool.Pool, username string) uuid.UUID {
	t.Helper()

	var id uuid.UUID
	err := pool.QueryRow(t.Context(),
		`INSERT INTO members (clerk_user_id, username, display_name)
		 VALUES ($1, $1, $1) RETURNING id`, username).Scan(&id)
	require.NoError(t, err)

	return id
}

// seedWork inserts a work straight into the catalogue, timestamp included, so
// the keyset order a listing test asserts is fixed rather than guessed.
func seedWork(t *testing.T, pool *pgxpool.Pool, title, category string, createdAt time.Time) uuid.UUID {
	t.Helper()

	var id uuid.UUID
	err := pool.QueryRow(t.Context(),
		`INSERT INTO works (title, category, source, created_at, updated_at)
		 VALUES ($1, $2::work_category, 'manual', $3, $3) RETURNING id`,
		title, category, createdAt).Scan(&id)
	require.NoError(t, err)

	return id
}

// seedEntry inserts a library entry with a fixed timestamp, for the same reason.
func seedEntry(
	t *testing.T, pool *pgxpool.Pool, memberID, workID uuid.UUID, status string, createdAt time.Time,
) uuid.UUID {
	t.Helper()

	var id uuid.UUID
	err := pool.QueryRow(t.Context(),
		`INSERT INTO library_entries (member_id, work_id, status, created_at, updated_at)
		 VALUES ($1, $2, $3::library_status, $4, $4) RETURNING id`,
		memberID, workID, status, createdAt).Scan(&id)
	require.NoError(t, err)

	return id
}

// queryCounter is a pgx tracer that records every statement the pool runs, so
// a test can prove a listing is one round trip and not twenty-six.
type queryCounter struct {
	mu         sync.Mutex
	statements []string
}

func (c *queryCounter) TraceQueryStart(
	ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData,
) context.Context {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.statements = append(c.statements, data.SQL)

	return ctx
}

func (c *queryCounter) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}

func (c *queryCounter) reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.statements = nil
}

func (c *queryCounter) recorded() []string {
	c.mu.Lock()
	defer c.mu.Unlock()

	return append([]string(nil), c.statements...)
}

// sqlcArgument matches the placeholders sqlc rewrites into $1, $2, …, and
// sqlcEmbed the whole-row selector it expands into that table's columns.
var (
	sqlcArgument = regexp.MustCompile(`sqlc\.n?arg\(([A-Za-z_]+)\)`)
	sqlcEmbed    = regexp.MustCompile(`sqlc\.embed\(([A-Za-z_]+)\)`)
)

// namedQuery returns the SQL of one `-- name:` block of a query file, with the
// sqlc placeholders turned back into the positional parameters sqlc numbers
// them as: first appearance wins, and every later mention of the same name
// reuses that number.
//
// It reads the query file rather than restating the SQL, so the plan a test
// asserts is the plan of the statement that actually ships. A copy would go
// stale the first time somebody edits the query and the test would keep
// vouching for a statement nobody runs.
func namedQuery(t *testing.T, file, name string) string {
	t.Helper()

	raw, err := os.ReadFile(file)
	require.NoError(t, err)

	_, after, found := strings.Cut(string(raw), "-- name: "+name+" ")
	require.Truef(t, found, "%s declares no query called %s", file, name)

	// Drop the rest of the `-- name:` line itself — the `:one` or `:many`
	// annotation is sqlc's, not SQL.
	_, after, _ = strings.Cut(after, "\n")

	if next := strings.Index(after, "\n-- name: "); next != -1 {
		after = after[:next]
	}

	var body strings.Builder
	for _, line := range strings.Split(after, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "--") {
			continue
		}

		body.WriteString(line)
		body.WriteString("\n")
	}

	positions := map[string]int{}
	statement := sqlcArgument.ReplaceAllStringFunc(body.String(), func(match string) string {
		argument := sqlcArgument.FindStringSubmatch(match)[1]
		if _, seen := positions[argument]; !seen {
			positions[argument] = len(positions) + 1
		}

		return "$" + strconv.Itoa(positions[argument])
	})

	statement = sqlcEmbed.ReplaceAllString(statement, "$1.*")

	return strings.TrimSpace(statement)
}

// explain returns the textual plan Postgres chooses for a statement. It runs
// the statement, because a plan that is never executed cannot be shown to have
// avoided a sort it would have needed at this size.
func explain(t *testing.T, pool *pgxpool.Pool, statement string, args ...any) string {
	t.Helper()

	rows, err := pool.Query(t.Context(), "EXPLAIN (ANALYZE, BUFFERS) "+statement, args...)
	require.NoError(t, err)
	defer rows.Close()

	var plan strings.Builder
	for rows.Next() {
		var line string
		require.NoError(t, rows.Scan(&line))
		plan.WriteString(line)
		plan.WriteString("\n")
	}
	require.NoError(t, rows.Err())

	return plan.String()
}
