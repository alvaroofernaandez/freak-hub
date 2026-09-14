// Package httpx holds the transport helpers shared by every handler: the
// JSON writer for success responses, and the Problem envelope (ADR-0014,
// see problem.go) every error response uses, so clients only ever have to
// parse one error shape.
package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
)

// ErrTrailingData means the body carried something after the JSON document
// it was supposed to be. Callers answer it the same way as any other
// malformed body: 400 invalid_payload.
var ErrTrailingData = errors.New("the request body carries data after the JSON document")

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
// silently ignored — and rejecting anything after the document for the same
// reason.
//
// A decoder reads one document and stops, so `{"a":1}{"b":2}` used to
// succeed with the second half quietly unread: a partial success that looks
// exactly like a whole one. That is the failure mode "no unknown fields"
// exists to prevent, seen from the other end, so it is refused here rather
// than per handler. Trailing whitespace is not data — a newline is how most
// clients end a body.
//
// w must be the request's real ResponseWriter, not nil: http.MaxBytesReader
// needs it to mark the connection for closing once the limit is exceeded,
// and without a real writer a caller cannot reliably get back
// *http.MaxBytesError to distinguish "body too large" from "body malformed".
func DecodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(target); err != nil {
		return err
	}

	// More reports whether another element follows in the stream, and it
	// skips whitespace to answer.
	if decoder.More() {
		return ErrTrailingData
	}

	return nil
}
