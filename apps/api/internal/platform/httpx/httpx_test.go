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

func TestWriteJSONSerialisesThePayload(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()

	httpx.WriteJSON(recorder, http.StatusCreated, map[string]string{"id": "abc"})

	assert.Equal(t, http.StatusCreated, recorder.Code)
	assert.Equal(t, "application/json; charset=utf-8", recorder.Header().Get("Content-Type"))

	var body map[string]string
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, map[string]string{"id": "abc"}, body)
}

func TestWriteJSONSendsNoBodyForNoContent(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()

	httpx.WriteJSON(recorder, http.StatusNoContent, nil)

	assert.Equal(t, http.StatusNoContent, recorder.Code)
	assert.Empty(t, recorder.Body.String())
}

func TestWriteErrorUsesTheSharedEnvelope(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()

	httpx.WriteError(recorder, http.StatusNotFound, "invitation_not_found", "no existe")

	assert.Equal(t, http.StatusNotFound, recorder.Code)

	var body struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "invitation_not_found", body.Code)
	assert.Equal(t, "no existe", body.Message)
}
