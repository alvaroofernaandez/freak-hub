package httpx_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
)

func TestRecovererTurnsAPanicIntoAProblem500(t *testing.T) {
	t.Parallel()

	panicking := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("something exploded")
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)

	require.NotPanics(t, func() {
		httpx.Recoverer(panicking).ServeHTTP(recorder, request)
	})

	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.NotContains(t, recorder.Body.String(), "something exploded",
		"the panic value must never reach the response body")

	var body httpx.Problem
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, httpx.CodeInternal, body.Code)
}

// contextCapturingHandler is a minimal slog.Handler that records the context
// each log record was written with, so a test can prove a log call carried
// the request's context — and, through it, the request id — without also
// depending on cmd/api's logger wrapper (which is what actually renders
// request_id into the output; that belongs to a cmd/api test, not this one).
type contextCapturingHandler struct {
	captured *context.Context
}

func (h contextCapturingHandler) Enabled(context.Context, slog.Level) bool { return true }

func (h contextCapturingHandler) Handle(ctx context.Context, _ slog.Record) error {
	*h.captured = ctx
	return nil
}

func (h contextCapturingHandler) WithAttrs([]slog.Attr) slog.Handler { return h }
func (h contextCapturingHandler) WithGroup(string) slog.Handler      { return h }

func TestRecovererLogsThePanicWithTheRequestContext(t *testing.T) {
	// Deliberately not t.Parallel(): this test swaps the global slog default
	// for the duration of the call, which would race with any other test in
	// this package that triggers a log line (for instance, another
	// Recoverer test's own panic) while it is running in parallel.
	var captured context.Context
	previous := slog.Default()
	slog.SetDefault(slog.New(contextCapturingHandler{captured: &captured}))
	t.Cleanup(func() { slog.SetDefault(previous) })

	panicking := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request = request.WithContext(httpx.ContextWithRequestID(context.Background(), "the-request-id"))

	httpx.Recoverer(panicking).ServeHTTP(recorder, request)

	require.NotNil(t, captured, "Recoverer must log through slog with the request's context")
	assert.Equal(t, "the-request-id", httpx.RequestIDFrom(captured))
}

func TestRecovererRepanicsErrAbortHandler(t *testing.T) {
	t.Parallel()

	aborting := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic(http.ErrAbortHandler)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)

	assert.Panics(t, func() {
		httpx.Recoverer(aborting).ServeHTTP(recorder, request)
	})
}

func TestRecovererDoesNothingWhenNothingPanics(t *testing.T) {
	t.Parallel()

	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)

	httpx.Recoverer(ok).ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusOK, recorder.Code)
}
