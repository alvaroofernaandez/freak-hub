package httpx

import (
	"log/slog"
	"net/http"
	"runtime/debug"
)

// Recoverer turns a panic into a Problem 500 instead of a bare connection
// reset. It logs the panic value and stack trace — tagged with the
// request's correlation id via RequestIDFrom, same as every other log line
// in a request's lifetime — but never puts either in the response body: the
// client never gets more than the generic "internal_error" Problem.
//
// http.ErrAbortHandler is re-panicked rather than answered, per net/http's
// own convention: it signals the handler deliberately aborted the response
// (for instance, a hijacked connection) and must propagate, not be treated
// as an ordinary panic.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			rec := recover()
			if rec == nil {
				return
			}

			if rec == http.ErrAbortHandler { //nolint:errorlint // sentinel value, not a wrapped error
				panic(rec)
			}

			slog.ErrorContext(r.Context(), "panic recovered",
				slog.Any("panic", rec),
				slog.String("stack", string(debug.Stack())))

			WriteProblem(w, r, http.StatusInternalServerError, CodeInternal,
				"Algo ha fallado por nuestra parte.")
		}()

		next.ServeHTTP(w, r)
	})
}
