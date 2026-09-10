package api_test

import (
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
	yaml "go.yaml.in/yaml/v3"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
)

// openAPIProperty is the minimal shape contract_test.go needs from
// packages/contracts/openapi.yaml's Error schema property — just enough to
// read the `code` property's enum, nothing else.
type openAPIProperty struct {
	Enum []string `yaml:"enum"`
}

type openAPISchema struct {
	Properties map[string]openAPIProperty `yaml:"properties"`
}

type openAPIDoc struct {
	Components struct {
		Schemas map[string]openAPISchema `yaml:"schemas"`
	} `yaml:"components"`
}

// findOpenAPIContract walks up from the working directory (go test runs
// inside the package directory) until it finds
// packages/contracts/openapi.yaml, so the test does not hardcode how many
// directories separate internal/api from the repo root.
func findOpenAPIContract(t *testing.T) string {
	t.Helper()

	dir, err := os.Getwd()
	require.NoError(t, err)

	for range 10 {
		candidate := filepath.Join(dir, "packages", "contracts", "openapi.yaml")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}

		dir = parent
	}

	t.Fatal("could not find packages/contracts/openapi.yaml above the test's working directory")

	return ""
}

// TestContractCodesMatchTheRegistry is the parity test ADR-0014 requires:
// httpx's code registry (the Go source of truth for what a client can
// branch on) and openapi.yaml's `code` enum (the source of truth the web's
// generated types come from) must list exactly the same codes, in both
// directions.
func TestContractCodesMatchTheRegistry(t *testing.T) {
	t.Parallel()

	raw, err := os.ReadFile(findOpenAPIContract(t))
	require.NoError(t, err)

	var doc openAPIDoc
	require.NoError(t, yaml.Unmarshal(raw, &doc))

	errorSchema, ok := doc.Components.Schemas["Error"]
	require.True(t, ok, "openapi.yaml must declare a components.schemas.Error")

	codeProperty, ok := errorSchema.Properties["code"]
	require.True(t, ok, "the Error schema must declare a `code` property")
	require.NotEmpty(t, codeProperty.Enum, "the `code` property must enumerate every registered ErrorCode")

	contractCodes := make(map[string]bool, len(codeProperty.Enum))
	for _, code := range codeProperty.Enum {
		contractCodes[code] = true
	}

	registryCodes := make(map[string]bool)
	for _, code := range httpx.Codes() {
		registryCodes[string(code)] = true
	}

	var onlyInContract, onlyInRegistry []string

	for code := range contractCodes {
		if !registryCodes[code] {
			onlyInContract = append(onlyInContract, code)
		}
	}

	for code := range registryCodes {
		if !contractCodes[code] {
			onlyInRegistry = append(onlyInRegistry, code)
		}
	}

	sort.Strings(onlyInContract)
	sort.Strings(onlyInRegistry)

	require.Empty(t, onlyInContract, "openapi.yaml's `code` enum has codes httpx.Codes() does not know about")
	require.Empty(t, onlyInRegistry, "httpx.Codes() has codes openapi.yaml's `code` enum does not declare")
}
