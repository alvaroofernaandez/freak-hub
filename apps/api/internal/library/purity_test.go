package library_test

import (
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// domainPackages is every package under internal/library, named as a pattern
// rather than a list. A list only covers the packages that existed the day it
// was written, and the next subpackage — an importer, a second double —
// would slip past this rule unnoticed. The in-memory double is covered on
// purpose: a test double that reached for pgx would be proving nothing.
var domainPackages = []string{"./..."}

// forbiddenAnywhere are the adapters the domain must not reach, however
// indirectly (AGENTS.md, rule 3). Matching is by import path fragment, so a
// new pgx major or another Clerk package is caught too.
var forbiddenAnywhere = []string{
	"github.com/jackc/pgx",
	"github.com/go-chi/chi",
	"github.com/clerk/clerk-sdk-go",
	"github.com/svix/svix-webhooks",
	"internal/platform",
	"sqlcgen",
}

// forbiddenDirectly are standard-library packages the domain must not import
// itself. They cannot be checked transitively: github.com/google/uuid pulls
// database/sql/driver in to implement Scanner and Valuer, and every domain
// package in this repository already depends on uuid. What matters is that
// the domain never reaches for a database or a transport on its own.
var forbiddenDirectly = []string{
	"net/http",
	"database/sql",
	"os",
}

// TestTheDomainDoesNotKnowItsAdapters is the acceptance criterion the issue
// spells out as "verifiable with go list -deps", kept as a test so it is
// verified on every run instead of once, by hand, on the day it was written.
func TestTheDomainDoesNotKnowItsAdapters(t *testing.T) {
	t.Parallel()

	for _, dependency := range goList(t, append([]string{"list", "-deps"}, domainPackages...)) {
		for _, adapter := range forbiddenAnywhere {
			assert.NotContainsf(t, dependency, adapter,
				"the library domain reached %s through %s: define a port instead", adapter, dependency)
		}
	}
}

func TestTheDomainImportsNoTransportAndNoDatabase(t *testing.T) {
	t.Parallel()

	args := append([]string{"list", "-f", `{{join .Imports "\n"}}`}, domainPackages...)

	for _, imported := range goList(t, args) {
		for _, banned := range forbiddenDirectly {
			assert.NotEqualf(t, banned, imported,
				"the library domain imports %s: the adapters are what talk to the outside world", banned)
		}
	}
}

// goList runs the go tool and hands back the lines it printed.
func goList(t *testing.T, args []string) []string {
	t.Helper()

	goBinary, err := exec.LookPath("go")
	if err != nil {
		t.Skip("the go tool is not on PATH, so the dependency graph cannot be read")
	}

	out, err := exec.Command(goBinary, args...).CombinedOutput()
	require.NoErrorf(t, err, "go %s failed: %s", strings.Join(args, " "), out)

	return strings.Fields(string(out))
}
