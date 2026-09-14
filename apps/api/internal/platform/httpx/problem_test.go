package httpx_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
)

func TestWriteProblemSetsTheShapeAndContentType(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)

	httpx.WriteProblem(recorder, request, http.StatusNotFound, httpx.CodeUnknownIdentity,
		"La sesión es válida pero todavía no hay ficha de miembro.")

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Equal(t, "application/problem+json", recorder.Header().Get("Content-Type"))

	var body httpx.Problem
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))

	assert.Equal(t, "urn:freak-hub:problem:unknown_identity", body.Type)
	assert.Equal(t, "Ficha de miembro no encontrada", body.Title)
	assert.Equal(t, http.StatusNotFound, body.Status)
	assert.Equal(t, "La sesión es válida pero todavía no hay ficha de miembro.", body.Detail)
	assert.Equal(t, "/v1/me", body.Instance)
	assert.Equal(t, httpx.CodeUnknownIdentity, body.Code)
}

func TestWriteProblemKeepsCodeAndMessageForBackwardCompatibility(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/invitations", nil)

	httpx.WriteProblem(recorder, request, http.StatusConflict, httpx.CodeInvitationAlreadySent,
		"Ya hay una invitación pendiente para ese correo.")

	var body struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))

	assert.Equal(t, "invitation_already_sent", body.Code)
	assert.Equal(t, "Ya hay una invitación pendiente para ese correo.", body.Message)
}

func TestWriteProblemUsesTheRequestPathAsInstanceNeverTheQueryString(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/members?limit=0&cursor=abc", nil)

	httpx.WriteProblem(recorder, request, http.StatusBadRequest, httpx.CodeInvalidLimit, "no válido")

	var body httpx.Problem
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "/v1/members", body.Instance)
}

func TestWriteProblemSetsFieldErrorsForAFieldScopedCode(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/invitations", nil)

	httpx.WriteProblem(recorder, request, http.StatusUnprocessableEntity, httpx.CodeInvalidEmail, "no válido")

	var body httpx.Problem
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.Len(t, body.FieldErrors, 1)
	assert.Equal(t, "email", body.FieldErrors[0].Field)
	assert.Equal(t, httpx.CodeInvalidEmail, body.FieldErrors[0].Code)
}

func TestWriteProblemOmitsFieldErrorsForAnUnscopedCode(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)

	httpx.WriteProblem(recorder, request, http.StatusInternalServerError, httpx.CodeInternal, "fallo")

	assert.NotContains(t, recorder.Body.String(), "field_errors")
}

func TestWriteProblemSetsRetryableFromTheRegistry(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)

	httpx.WriteProblem(recorder, request, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable, "no disponible")

	var body httpx.Problem
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.True(t, body.Retryable)
}

func TestWriteProblemDefaultsToNotRetryable(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)

	httpx.WriteProblem(recorder, request, http.StatusNotFound, httpx.CodeNotFound, "no existe")

	var body httpx.Problem
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.False(t, body.Retryable)
}

func TestWriteProblemSetsRetryAfterHeaderAndBodyWhenGiven(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)

	httpx.WriteProblem(recorder, request, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable, "no disponible",
		httpx.WithRetryAfterSeconds(30))

	assert.Equal(t, "30", recorder.Header().Get("Retry-After"))

	var body httpx.Problem
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.NotNil(t, body.RetryAfter)
	assert.Equal(t, 30, *body.RetryAfter)
}

func TestWriteProblemCarriesTheCorrelationIDFromContext(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	request = request.WithContext(httpx.ContextWithRequestID(request.Context(), "abc123deadbeef"))

	httpx.WriteProblem(recorder, request, http.StatusInternalServerError, httpx.CodeInternal, "fallo")

	var body httpx.Problem
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "abc123deadbeef", body.CorrelationID)
}

// TestWriteProblemDescribesTheLibraryCodes pins the registry entries the
// library contract (packages/contracts/openapi.yaml) introduced. A code the
// registry does not describe still serialises — codeRegistry is a map, so a
// miss yields the zero codeInfo — and the only visible symptom is an empty
// title reaching a client. This is what makes that loud.
func TestWriteProblemDescribesTheLibraryCodes(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		code  httpx.ErrorCode
		field string
	}{
		{name: "already in library", code: httpx.CodeAlreadyInLibrary, field: "work_id"},
		{name: "rating not allowed", code: httpx.CodeRatingNotAllowed, field: "rating"},
		{name: "invalid progress", code: httpx.CodeInvalidProgress, field: "progress"},
		{name: "invalid transition", code: httpx.CodeInvalidTransition, field: "status"},
		// work_not_found blames no single field: it answers both
		// GET /v1/works/{id}, where the id is a path segment, and
		// POST /v1/library, where it is the work_id property.
		{name: "work not found", code: httpx.CodeWorkNotFound, field: ""},
		// library_entry_not_found blames none either: the id it rejects is
		// a path segment, never a body property.
		{name: "library entry not found", code: httpx.CodeLibraryEntryNotFound, field: ""},
		// invalid_filter blames none: field_errors names request-body
		// fields, and the value it rejects is a query parameter — which of
		// status or category is ambiguous anyway. Same shape as its
		// siblings invalid_limit and invalid_cursor.
		{name: "invalid filter", code: httpx.CodeInvalidFilter, field: ""},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, "/v1/library", nil)

			httpx.WriteProblem(recorder, request, http.StatusConflict, testCase.code, "detalle")

			var body httpx.Problem
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))

			assert.NotEmpty(t, body.Title, "the registry must describe %s with a title", testCase.code)
			assert.False(t, body.Retryable, "%s is a domain rule, never transient", testCase.code)

			if testCase.field == "" {
				assert.Empty(t, body.FieldErrors, "%s blames no single field", testCase.code)

				return
			}

			require.Len(t, body.FieldErrors, 1)
			assert.Equal(t, testCase.field, body.FieldErrors[0].Field)
			assert.Equal(t, testCase.code, body.FieldErrors[0].Code)
		})
	}
}
