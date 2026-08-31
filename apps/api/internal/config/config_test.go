package config_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/config"
)

// env builds a getenv function backed by a map, so the tests never touch the
// real process environment and can run in parallel.
func env(overrides map[string]string) func(string) string {
	values := map[string]string{
		"DATABASE_URL":                 "postgres://user:pass@localhost:5432/freakhub",
		"CLERK_SECRET_KEY":             "sk_test_123",
		"CLERK_WEBHOOK_SIGNING_SECRET": "whsec_123",
	}
	for k, v := range overrides {
		if v == "" {
			delete(values, k)
			continue
		}
		values[k] = v
	}

	return func(key string) string { return values[key] }
}

func TestLoadAppliesDefaults(t *testing.T) {
	t.Parallel()

	cfg, err := config.Load(env(nil))

	require.NoError(t, err)
	assert.Equal(t, "development", cfg.Env)
	assert.Equal(t, 8080, cfg.Port)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.Equal(t, []string{"http://localhost:3000"}, cfg.AllowedOrigins)
}

func TestLoadReadsOverrides(t *testing.T) {
	t.Parallel()

	cfg, err := config.Load(env(map[string]string{
		"API_ENV":             "production",
		"API_PORT":            "9090",
		"API_LOG_LEVEL":       "warn",
		"API_ALLOWED_ORIGINS": "https://freakhub.es, https://www.freakhub.es",
	}))

	require.NoError(t, err)
	assert.Equal(t, "production", cfg.Env)
	assert.Equal(t, 9090, cfg.Port)
	assert.Equal(t, "warn", cfg.LogLevel)
	assert.Equal(t, []string{"https://freakhub.es", "https://www.freakhub.es"}, cfg.AllowedOrigins)
}

func TestLoadRequiresCriticalSettings(t *testing.T) {
	t.Parallel()

	for _, missing := range []string{"DATABASE_URL", "CLERK_SECRET_KEY", "CLERK_WEBHOOK_SIGNING_SECRET"} {
		t.Run(missing, func(t *testing.T) {
			t.Parallel()

			_, err := config.Load(env(map[string]string{missing: ""}))

			require.Error(t, err)
			assert.Contains(t, err.Error(), missing)
		})
	}
}

func TestLoadRejectsNonNumericPort(t *testing.T) {
	t.Parallel()

	_, err := config.Load(env(map[string]string{"API_PORT": "ocho-mil"}))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "API_PORT")
}

func TestLoadRejectsProductionWithoutExplicitOrigins(t *testing.T) {
	t.Parallel()

	_, err := config.Load(env(map[string]string{"API_ENV": "production"}))

	require.Error(t, err)
	assert.Contains(t, err.Error(), "API_ALLOWED_ORIGINS")
}
