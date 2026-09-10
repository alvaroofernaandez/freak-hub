package httpx

import (
	"context"
	"log/slog"
)

// requestIDLogHandler wraps a slog.Handler so every record written with a
// request's context automatically carries request_id — the same id the
// response got on X-Request-ID and the Problem body got as correlation_id
// (ADR-0014). Callers never have to remember to pass slog.String("request_id", ...)
// themselves; RequestIDFrom does the lookup once, here.
type requestIDLogHandler struct {
	slog.Handler
}

// NewRequestIDLogHandler wraps inner so cmd/api's default logger tags every
// request-scoped log line with request_id.
func NewRequestIDLogHandler(inner slog.Handler) slog.Handler {
	return requestIDLogHandler{Handler: inner}
}

func (h requestIDLogHandler) Handle(ctx context.Context, record slog.Record) error {
	if id := RequestIDFrom(ctx); id != "" {
		record.AddAttrs(slog.String("request_id", id))
	}

	return h.Handler.Handle(ctx, record)
}

func (h requestIDLogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return requestIDLogHandler{Handler: h.Handler.WithAttrs(attrs)}
}

func (h requestIDLogHandler) WithGroup(name string) slog.Handler {
	return requestIDLogHandler{Handler: h.Handler.WithGroup(name)}
}
