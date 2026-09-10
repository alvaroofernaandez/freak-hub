package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
)

// FieldError pairs a request field with the code that rejected it. Only
// emitted when the code unambiguously blames one field (ADR-0014).
type FieldError struct {
	Field string    `json:"field"`
	Code  ErrorCode `json:"code"`
}

// Problem is the Problem Details (RFC 9457) envelope every error response
// uses, served as application/problem+json (ADR-0014). Code and Message are
// kept alongside the RFC fields for backward compatibility: Code is the
// stable, machine-readable identifier clients should branch on; Message
// duplicates Detail and is deprecated.
type Problem struct {
	Type          string       `json:"type"`
	Title         string       `json:"title"`
	Status        int          `json:"status"`
	Detail        string       `json:"detail,omitempty"`
	Instance      string       `json:"instance,omitempty"`
	Code          ErrorCode    `json:"code"`
	Message       string       `json:"message"`
	CorrelationID string       `json:"correlation_id,omitempty"`
	Retryable     bool         `json:"retryable,omitempty"`
	RetryAfter    *int         `json:"retry_after,omitempty"`
	FieldErrors   []FieldError `json:"field_errors,omitempty"`
}

// ProblemOption customises a Problem beyond what the code registry decides
// by default.
type ProblemOption func(*Problem)

// WithRetryAfterSeconds sets retry_after (body) and Retry-After (header) to
// seconds. Use it only when the delay is actually known; Retryable alone is
// enough otherwise.
func WithRetryAfterSeconds(seconds int) ProblemOption {
	return func(p *Problem) { p.RetryAfter = &seconds }
}

// WriteProblem answers with the shared Problem envelope (ADR-0014). status
// is the transport-level HTTP status; code is the stable identifier the
// registry (codes.go) supplies a title, default Retryable flag and — for
// field-scoped codes — a FieldErrors entry for. detail is the Spanish prose
// explaining this specific occurrence, and becomes both Detail and the
// deprecated Message.
func WriteProblem(w http.ResponseWriter, r *http.Request, status int, code ErrorCode, detail string, opts ...ProblemOption) {
	info := codeRegistry[code]

	problem := Problem{
		Type:          "urn:freak-hub:problem:" + string(code),
		Title:         info.Title,
		Status:        status,
		Detail:        detail,
		Instance:      r.URL.Path,
		Code:          code,
		Message:       detail,
		CorrelationID: RequestIDFrom(r.Context()),
		Retryable:     info.Retryable,
	}

	if info.Field != "" {
		problem.FieldErrors = []FieldError{{Field: info.Field, Code: code}}
	}

	for _, opt := range opts {
		opt(&problem)
	}

	if problem.RetryAfter != nil {
		w.Header().Set("Retry-After", strconv.Itoa(*problem.RetryAfter))
	}

	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(problem); err != nil {
		// The status line is already on the wire, so all we can do is record it.
		slog.ErrorContext(r.Context(), "failed to encode problem body", slog.Any("error", err))
	}
}
