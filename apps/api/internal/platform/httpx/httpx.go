// Package httpx holds the transport helpers shared by every handler: one JSON
// writer and one error envelope, so clients only ever have to parse one shape.
package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// ErrorCode is the stable, machine-readable half of an error response. Clients
// branch on this; the message is for humans and may change wording freely.
type ErrorCode string

// The error codes the API answers with. Clients branch on these.
const (
	CodeBadRequest      ErrorCode = "bad_request"
	CodeUnauthorized    ErrorCode = "unauthorized"
	CodeForbidden       ErrorCode = "forbidden"
	CodeNotFound        ErrorCode = "not_found"
	CodeConflict        ErrorCode = "conflict"
	CodeInternal        ErrorCode = "internal_error"
	CodeInvalidPayload  ErrorCode = "invalid_payload"
	CodeMissingToken    ErrorCode = "missing_token"
	CodeInvalidToken    ErrorCode = "invalid_token"
	CodeUnknownIdentity ErrorCode = "unknown_identity"
)

// ErrorBody is the single error envelope the whole API answers with.
type ErrorBody struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
}

// WriteJSON writes a JSON response, omitting the body for 204 responses.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
	if status == http.StatusNoContent || payload == nil {
		w.WriteHeader(status)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// The status line is already on the wire, so all we can do is record it.
		slog.Error("failed to encode response body", slog.Any("error", err))
	}
}

// WriteError answers with the shared error envelope.
func WriteError(w http.ResponseWriter, status int, code ErrorCode, message string) {
	WriteJSON(w, status, ErrorBody{Code: code, Message: message})
}

// DecodeJSON reads a JSON request body, rejecting unknown fields so a typo in a
// client payload fails loudly instead of being silently ignored.
func DecodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	decoder.DisallowUnknownFields()

	return decoder.Decode(target)
}
