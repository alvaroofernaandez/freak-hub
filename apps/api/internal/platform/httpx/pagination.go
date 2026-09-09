package httpx

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
)

// Page is the single page envelope every listing endpoint answers with
// (ADR-0011: docs/decisions/0011-paginacion-por-cursor.md) — a listing never
// returns a bare array.
type Page[T any] struct {
	Items      []T     `json:"items"`
	NextCursor *string `json:"next_cursor"`
}

// PageCursor is an opaque keyset pagination position: the (created_at, id)
// pair of the last row returned on the previous page.
type PageCursor struct {
	CreatedAt time.Time
	ID        uuid.UUID
}

// cursorPayload is the JSON shape encoded into the opaque cursor string.
type cursorPayload struct {
	CreatedAt string `json:"t"`
	ID        string `json:"i"`
}

// EncodeCursor turns a page position into the opaque string clients pass back
// as ?cursor=. Its shape is an implementation detail that may change without
// notice (ADR-0011).
func EncodeCursor(cursor PageCursor) string {
	payload := cursorPayload{
		CreatedAt: cursor.CreatedAt.UTC().Format(time.RFC3339Nano),
		ID:        cursor.ID.String(),
	}

	// A cursorPayload of two strings always marshals cleanly.
	raw, _ := json.Marshal(payload) //nolint:errcheck

	return base64.RawURLEncoding.EncodeToString(raw)
}

// DecodeCursor reverses EncodeCursor. Any malformed input is an error the
// caller should answer with 400 invalid_cursor.
func DecodeCursor(raw string) (PageCursor, error) {
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return PageCursor{}, fmt.Errorf("decode cursor: %w", err)
	}

	var payload cursorPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return PageCursor{}, fmt.Errorf("decode cursor: %w", err)
	}

	createdAt, err := time.Parse(time.RFC3339Nano, payload.CreatedAt)
	if err != nil {
		return PageCursor{}, fmt.Errorf("decode cursor timestamp: %w", err)
	}

	id, err := uuid.Parse(payload.ID)
	if err != nil {
		return PageCursor{}, fmt.Errorf("decode cursor id: %w", err)
	}

	return PageCursor{CreatedAt: createdAt, ID: id}, nil
}

// ParseLimit reads a ?limit= query value, falling back to def when raw is
// empty. Range validation is a domain policy (see users.MinListLimit and
// friends), not a transport concern, so it is deliberately not done here.
func ParseLimit(raw string, def int) (int, error) {
	if raw == "" {
		return def, nil
	}

	limit, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("parse limit: %w", err)
	}

	return limit, nil
}
