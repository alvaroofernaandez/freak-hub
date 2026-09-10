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
