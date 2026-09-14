package api

import (
	"encoding/json"
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

// libraryEntryResponse is the wire shape of a LibraryEntry.
//
// There is no member_id and no work_id. The entry is the caller's by
// construction — a listing only ever walks their own library and every
// single-entry route goes through the owner check — so echoing the owner
// back would be a property the contract never declared. The work travels
// whole instead of as an id, which is what lets a library screen render
// titles and covers from the page it already fetched.
type libraryEntryResponse struct {
	ID          string       `json:"id"`
	Work        workResponse `json:"work"`
	Status      string       `json:"status"`
	Progress    int          `json:"progress"`
	Rating      *int         `json:"rating"`
	IsFavourite bool         `json:"is_favourite"`
	Owned       bool         `json:"owned"`
	Note        *string      `json:"note"`
	StartedAt   *string      `json:"started_at"`
	FinishedAt  *string      `json:"finished_at"`
	CreatedAt   string       `json:"created_at"`
	UpdatedAt   string       `json:"updated_at"`
}

func toLibraryEntryResponse(entry library.EntryWithWork) libraryEntryResponse {
	return libraryEntryResponse{
		ID:          entry.ID.String(),
		Work:        toWorkResponse(entry.Work),
		Status:      string(entry.Status),
		Progress:    entry.Progress,
		Rating:      entry.Rating,
		IsFavourite: entry.IsFavourite,
		Owned:       entry.Owned,
		Note:        entry.Note,
		StartedAt:   formatOptionalTimestamp(entry.StartedAt),
		FinishedAt:  formatOptionalTimestamp(entry.FinishedAt),
		CreatedAt:   formatTimestamp(entry.CreatedAt),
		UpdatedAt:   formatTimestamp(entry.UpdatedAt),
	}
}

// listLibraryEntries answers the caller's own library, keyset-paginated per
// ADR-0011.
//
// The owner is not a filter the caller can set: it comes from the session,
// and library.Service.ListLibrary overwrites whatever the filter carried
// with it anyway. Two locks on the same door, deliberately.
func (h *handlers) listLibraryEntries(w http.ResponseWriter, r *http.Request) {
	member, ok := h.resolveCaller(w, r)
	if !ok {
		return
	}

	limit, after, ok := h.pageParams(w, r, library.DefaultListLimit)
	if !ok {
		return
	}

	filter := library.EntryFilter{
		Status:   library.Status(r.URL.Query().Get("status")),
		Category: library.Category(r.URL.Query().Get("category")),
	}

	entries, next, err := h.library.ListLibrary(r.Context(), member.ID, filter, after, limit)
	if err != nil {
		h.fail(w, r, "list library", err)
		return
	}

	items := make([]libraryEntryResponse, 0, len(entries))
	for _, entry := range entries {
		items = append(items, toLibraryEntryResponse(entry))
	}

	httpx.WriteJSON(w, http.StatusOK,
		httpx.Page[libraryEntryResponse]{Items: items, NextCursor: encodeNext(next)})
}

// createLibraryEntryRequest is the body of POST /v1/library. It carries no
// member_id on purpose: the owner is the session's member, and
// DisallowUnknownFields (httpx.DecodeJSON) is what turns an attempt to
// smuggle one in into a 400 rather than a write into somebody else's
// library.
type createLibraryEntryRequest struct {
	WorkID string `json:"work_id"`
	Status string `json:"status"`
	// progress, is_favourite and owned carry a default rather than a null, so
	// they need the same absent/null/value reading a PATCH does. Their zero
	// value IS the contract's default, which is why an absent property needs
	// nothing done to it — and also why reading a null as that same zero
	// would have looked harmless right up until one of those defaults changed.
	Progress    optionalField[int]  `json:"progress"`
	IsFavourite optionalField[bool] `json:"is_favourite"`
	Owned       optionalField[bool] `json:"owned"`
	Rating      *int                `json:"rating"`
	Note        *string             `json:"note"`
	StartedAt   *time.Time          `json:"started_at"`
	FinishedAt  *time.Time          `json:"finished_at"`
}

// nulledNonNullable reports a property that arrived as an explicit null where
// the contract declares no null. status is not among them because a null
// decodes to the empty string, which is not one of the six statuses and the
// domain refuses it for that reason.
func (c createLibraryEntryRequest) nulledNonNullable() bool {
	return c.Progress.nulled() || c.IsFavourite.nulled() || c.Owned.nulled()
}

func (h *handlers) createLibraryEntry(w http.ResponseWriter, r *http.Request) {
	var payload createLibraryEntryRequest
	if !decodeJSON(w, r, &payload) {
		return
	}

	if payload.nulledNonNullable() {
		httpx.WriteProblem(w, r, http.StatusBadRequest, httpx.CodeInvalidPayload,
			"Ese campo no admite el valor nulo.")

		return
	}

	workID, err := uuid.Parse(payload.WorkID)
	if err != nil {
		httpx.WriteProblem(w, r, http.StatusBadRequest, httpx.CodeInvalidPayload,
			"El identificador de la obra no es válido.")

		return
	}

	member, ok := h.resolveCaller(w, r)
	if !ok {
		return
	}

	entry, err := h.library.AddToLibrary(r.Context(), member.ID, library.AddToLibraryInput{
		WorkID:      workID,
		Status:      library.Status(payload.Status),
		Progress:    payload.Progress.value,
		Rating:      payload.Rating,
		IsFavourite: payload.IsFavourite.value,
		Owned:       payload.Owned.value,
		Note:        payload.Note,
		StartedAt:   payload.StartedAt,
		FinishedAt:  payload.FinishedAt,
	})
	if err != nil {
		h.fail(w, r, "add to library", err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, toLibraryEntryResponse(entry))
}

// optionalField carries one property of a PATCH body through the three
// states JSON actually has: absent, null, and a value.
//
// The obvious spelling — a **int, one indirection for "present" and one for
// "null" — does not work, and it is worth writing down why, because it looks
// like it should. encoding/json documents that unmarshalling the literal
// null into a pointer sets that pointer to nil, so `{"rating": null}` and a
// body with no rating at all both leave the outer pointer nil. The two
// states collapse, and clearing a score becomes unexpressible.
//
// What does work is an Unmarshaler, because the decoder calls UnmarshalJSON
// *including when the input is null*. That call is the "present" flag; what
// it does with the bytes is the rest.
type optionalField[T any] struct {
	present bool
	null    bool
	value   T
}

// UnmarshalJSON records that the property was carried at all, then decodes
// it. A null is kept as a fact rather than decoded, so a property the
// contract declares non-nullable can refuse it instead of silently reading
// as its zero value — which is how `{"is_favourite": null}` would otherwise
// un-favourite something nobody asked to change.
func (o *optionalField[T]) UnmarshalJSON(data []byte) error {
	o.present = true

	if string(data) == "null" {
		o.null = true

		return nil
	}

	return json.Unmarshal(data, &o.value)
}

// field turns the property into the domain's own absent/null/value carrier.
func (o optionalField[T]) field() library.Field[T] {
	if !o.present {
		return library.Field[T]{}
	}

	return library.Set(o.value)
}

// nulled reports whether the property arrived carrying an explicit null.
func (o optionalField[T]) nulled() bool {
	return o.present && o.null
}

// updateLibraryEntryRequest is the body of PATCH /v1/library/{id}.
//
// work_id is not a property: an entry never changes the work it points at,
// so an attempt to move it is an unknown field and a 400.
type updateLibraryEntryRequest struct {
	Status      optionalField[string]     `json:"status"`
	Progress    optionalField[int]        `json:"progress"`
	Rating      optionalField[*int]       `json:"rating"`
	IsFavourite optionalField[bool]       `json:"is_favourite"`
	Owned       optionalField[bool]       `json:"owned"`
	Note        optionalField[*string]    `json:"note"`
	StartedAt   optionalField[*time.Time] `json:"started_at"`
	FinishedAt  optionalField[*time.Time] `json:"finished_at"`
}

// patch maps the body onto the domain's EntryPatch, or reports which
// non-nullable property arrived as null.
func (u updateLibraryEntryRequest) patch() (library.EntryPatch, bool) {
	// status, progress, is_favourite and owned are the four properties the
	// contract declares with no null in their type. Letting a null through
	// would read as the zero value and quietly un-favourite something, or
	// send progress back to zero, on a request that asked for neither.
	if u.Status.nulled() || u.Progress.nulled() || u.IsFavourite.nulled() || u.Owned.nulled() {
		return library.EntryPatch{}, false
	}

	patch := library.EntryPatch{
		Progress:    u.Progress.field(),
		Rating:      u.Rating.field(),
		IsFavourite: u.IsFavourite.field(),
		Owned:       u.Owned.field(),
		Note:        u.Note.field(),
		StartedAt:   u.StartedAt.field(),
		FinishedAt:  u.FinishedAt.field(),
	}

	if status, ok := u.Status.field().Get(); ok {
		patch.Status = library.Set(library.Status(status))
	}

	return patch, true
}

func (h *handlers) getLibraryEntry(w http.ResponseWriter, r *http.Request) {
	member, entryID, ok := h.ownEntryRequest(w, r)
	if !ok {
		return
	}

	entry, err := h.library.GetEntry(r.Context(), member, entryID)
	if err != nil {
		h.fail(w, r, "get library entry", err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, toLibraryEntryResponse(entry))
}

func (h *handlers) updateLibraryEntry(w http.ResponseWriter, r *http.Request) {
	var payload updateLibraryEntryRequest
	if !decodeJSON(w, r, &payload) {
		return
	}

	patch, ok := payload.patch()
	if !ok {
		httpx.WriteProblem(w, r, http.StatusBadRequest, httpx.CodeInvalidPayload,
			"Ese campo no admite el valor nulo.")

		return
	}

	member, entryID, ok := h.ownEntryRequest(w, r)
	if !ok {
		return
	}

	entry, err := h.library.UpdateEntry(r.Context(), member, entryID, patch)
	if err != nil {
		h.fail(w, r, "update library entry", err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, toLibraryEntryResponse(entry))
}

func (h *handlers) deleteLibraryEntry(w http.ResponseWriter, r *http.Request) {
	member, entryID, ok := h.ownEntryRequest(w, r)
	if !ok {
		return
	}

	if err := h.library.RemoveFromLibrary(r.Context(), member, entryID); err != nil {
		h.fail(w, r, "remove from library", err)
		return
	}

	httpx.WriteJSON(w, http.StatusNoContent, nil)
}

// ownEntryRequest resolves the two things every /v1/library/{id} route needs:
// the member the session names, and the entry id in the path.
//
// It does not check ownership, and it deliberately cannot: that check belongs
// to library.Service, which is the one place every use case passes through.
// A handler that resolved the entry itself — EntryRepository.ByID takes no
// member — would hand any member anybody else's entry, which is exactly the
// leak this issue is about. The comment on UpdateLibraryEntry in
// db/queries/library_entries.sql says the same thing from the other end: the
// per-member scope on that one statement is not evidence the reads have it.
//
// A malformed id answers like a missing one, for the same reason somebody
// else's does: from outside there is nothing there either way.
func (h *handlers) ownEntryRequest(w http.ResponseWriter, r *http.Request) (uuid.UUID, uuid.UUID, bool) {
	member, ok := h.resolveCaller(w, r)
	if !ok {
		return uuid.Nil, uuid.Nil, false
	}

	entryID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		h.fail(w, r, "resolve library entry", library.ErrEntryNotFound)

		return uuid.Nil, uuid.Nil, false
	}

	return member.ID, entryID, true
}
