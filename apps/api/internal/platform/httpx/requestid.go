package httpx

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"regexp"
)

type requestIDContextKey struct{}

// validRequestID is what an inbound X-Request-ID must match to be reused
// instead of replaced: opaque, ASCII, a length a spoofed or truncated value
// is unlikely to hit by accident. It never matches anything that could carry
// a hostname or other machine-identifying text, unlike chi's default
// generator.
var validRequestID = regexp.MustCompile(`^[A-Za-z0-9-]{8,64}$`)

// ContextWithRequestID attaches a request id to ctx. Exported so tests and
// RequestIDMiddleware share the one path for storing it.
func ContextWithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDContextKey{}, id)
}

// RequestIDFrom returns the request id RequestIDMiddleware stored, or "" for
// a context that never went through it.
func RequestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(requestIDContextKey{}).(string)
	return id
}

// NewRequestID mints an opaque 128-bit correlation id, hex-encoded. It never
// contains the hostname or any other machine-identifying information —
// unlike chi middleware.RequestID's default generator, which does.
func NewRequestID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		// crypto/rand.Read failing means the OS has no entropy source, which
		// is effectively unrecoverable. Degrade instead of panicking
		// mid-request: every id from this fallback is identical, which is
		// still a valid (if useless for correlation) opaque id.
		return "unavailable-request-id"
	}

	return hex.EncodeToString(buf)
}

// RequestIDMiddleware assigns every request an opaque correlation id: it
// reuses an inbound X-Request-ID header when it matches validRequestID,
// otherwise mints a new one with NewRequestID. It always echoes the id back
// on the X-Request-ID response header and stores it in the request context
// for RequestIDFrom (and, via the logger set up in cmd/api, every log line
// written during the request).
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if !validRequestID.MatchString(id) {
			id = NewRequestID()
		}

		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(ContextWithRequestID(r.Context(), id)))
	})
}
