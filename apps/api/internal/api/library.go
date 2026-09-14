package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/library"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
)

// timestampLayout is RFC 3339, which is the `format: date-time` every
// timestamp in packages/contracts/openapi.yaml declares.
const timestampLayout = "2006-01-02T15:04:05Z07:00"

func formatTimestamp(at time.Time) string {
	return at.UTC().Format(timestampLayout)
}

// formatOptionalTimestamp keeps a missing date as JSON null rather than as
// the zero instant, which would read as "1 January of year 1" to a client.
func formatOptionalTimestamp(at *time.Time) *string {
	if at == nil {
		return nil
	}

	formatted := formatTimestamp(*at)

	return &formatted
}

// optionalString turns the domain's "empty means absent" into the contract's
// explicit null. The two are different promises: `cover_url` is declared
// `format: uri`, and an empty string is not a uri.
func optionalString(value string) *string {
	if value == "" {
		return nil
	}

	return &value
}

// workResponse is the wire shape of a Work. Every property the contract
// declares is required, so none of them carries omitempty: a client reading
// generated types expects the key to be there, holding null when there is
// nothing to say.
type workResponse struct {
	ID          string           `json:"id"`
	Title       string           `json:"title"`
	Category    string           `json:"category"`
	Source      string           `json:"source"`
	SourceID    *string          `json:"source_id"`
	CoverURL    *string          `json:"cover_url"`
	Synopsis    *string          `json:"synopsis"`
	Year        *int             `json:"year"`
	Metadata    library.Metadata `json:"metadata"`
	ExpansionOf *string          `json:"expansion_of"`
	CreatedAt   string           `json:"created_at"`
	UpdatedAt   string           `json:"updated_at"`
}

func toWorkResponse(work library.Work) workResponse {
	// metadata is a required, non-nullable object: a nil map would marshal to
	// null and break a client that expects to index it.
	metadata := work.Metadata
	if metadata == nil {
		metadata = library.Metadata{}
	}

	var expansionOf *string
	if work.ExpansionOf != nil {
		id := work.ExpansionOf.String()
		expansionOf = &id
	}

	return workResponse{
		ID:          work.ID.String(),
		Title:       work.Title,
		Category:    string(work.Category),
		Source:      string(work.Source),
		SourceID:    optionalString(work.SourceID),
		CoverURL:    optionalString(work.CoverURL),
		Synopsis:    optionalString(work.Synopsis),
		Year:        work.Year,
		Metadata:    metadata,
		ExpansionOf: expansionOf,
		CreatedAt:   formatTimestamp(work.CreatedAt),
		UpdatedAt:   formatTimestamp(work.UpdatedAt),
	}
}

// listWorks searches the shared catalogue, keyset-paginated per ADR-0011.
//
// It resolves no local member on purpose: the catalogue belongs to the whole
// group, nothing here is scoped to a caller, and asking for the member row
// would invent a 404 the contract does not declare for this route.
//
// A cursor carries a position — (created_at, id) — and not the filters that
// produced it, so re-sending it under a different filter is accepted rather
// than rejected: the listing order is the same for every filter, so the page
// that comes back is a correct page of the new filter, merely one that
// starts part-way down. What it is not is a *complete* walk, which is why
// the contract asks clients to start from no cursor whenever a filter
// changes.
func (h *handlers) listWorks(w http.ResponseWriter, r *http.Request) {
	limit, after, ok := h.pageParams(w, r, library.DefaultListLimit)
	if !ok {
		return
	}

	filter := library.WorkFilter{
		Category: library.Category(r.URL.Query().Get("category")),
		Query:    r.URL.Query().Get("q"),
	}

	works, next, err := h.library.SearchWorks(r.Context(), filter, after, limit)
	if err != nil {
		h.fail(w, r, "search works", err)
		return
	}

	items := make([]workResponse, 0, len(works))
	for _, work := range works {
		items = append(items, toWorkResponse(work))
	}

	httpx.WriteJSON(w, http.StatusOK, httpx.Page[workResponse]{Items: items, NextCursor: encodeNext(next)})
}

// createWorkRequest is the body of POST /v1/works. Neither source nor
// source_id is a field here, so DisallowUnknownFields is what refuses a
// client that tries to claim its record came from AniList.
type createWorkRequest struct {
	Title    string           `json:"title"`
	Category string           `json:"category"`
	CoverURL *string          `json:"cover_url"`
	Synopsis *string          `json:"synopsis"`
	Year     *int             `json:"year"`
	Metadata library.Metadata `json:"metadata"`
}

func (h *handlers) createWork(w http.ResponseWriter, r *http.Request) {
	var payload createWorkRequest
	if !decodeJSON(w, r, &payload) {
		return
	}

	work, err := h.library.CreateManualWork(r.Context(), library.ManualWorkInput{
		Title:    payload.Title,
		Category: library.Category(payload.Category),
		CoverURL: valueOrEmpty(payload.CoverURL),
		Synopsis: valueOrEmpty(payload.Synopsis),
		Year:     payload.Year,
		Metadata: payload.Metadata,
	})
	if err != nil {
		h.fail(w, r, "create manual work", err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, toWorkResponse(work))
}

func (h *handlers) getWork(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		// A malformed id is answered exactly like an unknown one: from the
		// caller's side both mean "there is nothing here", and the contract
		// says so.
		h.fail(w, r, "get work", library.ErrWorkNotFound)
		return
	}

	work, err := h.library.GetWork(r.Context(), id)
	if err != nil {
		h.fail(w, r, "get work", err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, toWorkResponse(work))
}

// pageParams reads ?limit= and ?cursor=, writing the response itself and
// reporting false when either is malformed. Range validation stays in the
// domain (library.MinListLimit and friends), which is what answers
// invalid_limit for a number that parses but is out of range.
func (h *handlers) pageParams(
	w http.ResponseWriter, r *http.Request, defaultLimit int,
) (int, *library.Cursor, bool) {
	limit, err := httpx.ParseLimit(r.URL.Query().Get("limit"), defaultLimit)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusBadRequest, httpx.CodeInvalidLimit,
			"El parámetro limit no es válido.")

		return 0, nil, false
	}

	raw := r.URL.Query().Get("cursor")
	if raw == "" {
		return limit, nil, true
	}

	decoded, err := httpx.DecodeCursor(raw)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusBadRequest, httpx.CodeInvalidCursor,
			"El parámetro cursor no es válido.")

		return 0, nil, false
	}

	return limit, &library.Cursor{CreatedAt: decoded.CreatedAt, ID: decoded.ID}, true
}

// encodeNext turns the domain's next-page position into the opaque string a
// client carries around, or null when this was the last page.
func encodeNext(next *library.Cursor) *string {
	if next == nil {
		return nil
	}

	encoded := httpx.EncodeCursor(httpx.PageCursor{CreatedAt: next.CreatedAt, ID: next.ID})

	return &encoded
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}
