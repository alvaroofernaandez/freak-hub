// Package httpx holds the transport helpers shared by every handler: the
// JSON writer for success responses, and the Problem envelope (ADR-0014,
// see problem.go) every error response uses, so clients only ever have to
// parse one error shape.
package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

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

// DecodeJSON reads a JSON request body, capped at 1 MiB, rejecting unknown
// fields so a typo in a client payload fails loudly instead of being
// silently ignored.
//
// w must be the request's real ResponseWriter, not nil: http.MaxBytesReader
// needs it to mark the connection for closing once the limit is exceeded,
// and without a real writer a caller cannot reliably get back
// *http.MaxBytesError to distinguish "body too large" from "body malformed".
func DecodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()

	return decoder.Decode(target)
}
