// Package auth turns a Clerk session token into an Identity the handlers can
// trust.
//
// The middleware depends on the Verifier port, not on Clerk itself: the real
// adapter lives in internal/platform/clerk, and the tests use a stub. That
// keeps the security-critical branching (missing header, wrong scheme, refused
// token) verifiable without network access or real JWTs.
package auth

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
)

// Identity is the authenticated caller, as asserted by Clerk.
type Identity struct {
	ClerkUserID string
	SessionID   string
}

// Verifier validates a session token. Implementations must treat every failure
// as a rejection: never return a zero Identity together with a nil error.
type Verifier interface {
	Verify(ctx context.Context, token string) (Identity, error)
}

type contextKey struct{}

var identityKey contextKey

const bearerPrefix = "bearer "

// Middleware rejects any request that does not carry a verifiable Clerk session
// token, and stores the resulting Identity in the request context.
func Middleware(verifier Verifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := bearerToken(r.Header.Get("Authorization"))
			if !ok {
				httpx.WriteError(w, http.StatusUnauthorized, httpx.CodeMissingToken,
					"Falta el token de sesión.")
				return
			}

			identity, err := verifier.Verify(r.Context(), token)
			if err != nil {
				// Log the cause for us; tell the caller nothing beyond "no".
				slog.WarnContext(r.Context(), "rejected session token",
					slog.String("path", r.URL.Path), slog.Any("error", err))
				httpx.WriteError(w, http.StatusUnauthorized, httpx.CodeInvalidToken,
					"La sesión no es válida o ha caducado.")
				return
			}

			next.ServeHTTP(w, r.WithContext(WithIdentity(r.Context(), identity)))
		})
	}
}

// WithIdentity stores an identity in the context. Exported for tests and for
// handlers that build a derived context.
func WithIdentity(ctx context.Context, identity Identity) context.Context {
	return context.WithValue(ctx, identityKey, identity)
}

// IdentityFrom returns the authenticated caller, if the request went through
// Middleware.
func IdentityFrom(ctx context.Context) (Identity, bool) {
	identity, ok := ctx.Value(identityKey).(Identity)
	return identity, ok
}

// bearerToken extracts the token from an Authorization header, accepting any
// capitalisation of the scheme as RFC 7235 requires.
func bearerToken(header string) (string, bool) {
	if len(header) < len(bearerPrefix) ||
		!strings.EqualFold(header[:len(bearerPrefix)], bearerPrefix) {
		return "", false
	}

	token := strings.TrimSpace(header[len(bearerPrefix):])

	return token, token != ""
}
