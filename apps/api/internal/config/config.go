// Package config resolves the API settings from the environment.
//
// Loading is a pure function of a `getenv` lookup so it can be tested without
// mutating the process environment, and it fails loudly at boot rather than
// letting a missing credential surface as a runtime 500 later on.
package config

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// Config holds every setting the API needs at boot.
type Config struct {
	Env            string
	Port           int
	LogLevel       string
	DatabaseURL    string
	AllowedOrigins []string
	Clerk          ClerkConfig
}

// ClerkConfig groups the credentials used to verify sessions and webhooks.
type ClerkConfig struct {
	SecretKey            string
	WebhookSigningSecret string
}

// IsProduction reports whether the API runs with production guarantees.
func (c Config) IsProduction() bool { return c.Env == "production" }

// Addr is the listen address for the HTTP server.
func (c Config) Addr() string { return fmt.Sprintf(":%d", c.Port) }

const (
	defaultEnv      = "development"
	defaultPort     = 8080
	defaultLogLevel = "info"
)

var defaultAllowedOrigins = []string{"http://localhost:3000"}

// Load reads and validates the configuration using the given lookup function.
func Load(getenv func(string) string) (Config, error) {
	var problems []error

	cfg := Config{
		Env:            valueOr(getenv("API_ENV"), defaultEnv),
		LogLevel:       valueOr(getenv("API_LOG_LEVEL"), defaultLogLevel),
		DatabaseURL:    strings.TrimSpace(getenv("DATABASE_URL")),
		AllowedOrigins: defaultAllowedOrigins,
		Clerk: ClerkConfig{
			SecretKey:            strings.TrimSpace(getenv("CLERK_SECRET_KEY")),
			WebhookSigningSecret: strings.TrimSpace(getenv("CLERK_WEBHOOK_SIGNING_SECRET")),
		},
	}

	port, err := parsePort(getenv("API_PORT"))
	if err != nil {
		problems = append(problems, err)
	}
	cfg.Port = port

	if origins := splitList(getenv("API_ALLOWED_ORIGINS")); len(origins) > 0 {
		cfg.AllowedOrigins = origins
	} else if cfg.IsProduction() {
		// Falling back to localhost in production would silently break the real
		// front end, so make the operator state the origins explicitly.
		problems = append(problems, errors.New("API_ALLOWED_ORIGINS is required when API_ENV is production"))
	}

	problems = append(problems, requireAll(map[string]string{
		"DATABASE_URL":                 cfg.DatabaseURL,
		"CLERK_SECRET_KEY":             cfg.Clerk.SecretKey,
		"CLERK_WEBHOOK_SIGNING_SECRET": cfg.Clerk.WebhookSigningSecret,
	})...)

	if err := errors.Join(problems...); err != nil {
		return Config{}, fmt.Errorf("invalid configuration: %w", err)
	}

	return cfg, nil
}

func parsePort(raw string) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return defaultPort, nil
	}

	port, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || port < 1 || port > 65535 {
		return 0, fmt.Errorf("API_PORT must be a number between 1 and 65535, got %q", raw)
	}

	return port, nil
}

func requireAll(values map[string]string) []error {
	problems := make([]error, 0, len(values))
	for key, value := range values {
		if value == "" {
			problems = append(problems, fmt.Errorf("%s is required", key))
		}
	}

	return problems
}

func splitList(raw string) []string {
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			values = append(values, trimmed)
		}
	}

	return values
}

func valueOr(value, fallback string) string {
	if trimmed := strings.TrimSpace(value); trimmed != "" {
		return trimmed
	}

	return fallback
}
