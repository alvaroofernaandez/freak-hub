package httpx_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestDecodeJSONRejectsABodyOverTheLimit(t *testing.T) {
	t.Parallel()

	huge := bytes.Repeat([]byte("a"), (1<<20)+1)
	body := `{"name":"` + string(huge) + `"}`

	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	recorder := httptest.NewRecorder()

	var target struct {
		Name string `json:"name"`
	}
	err := httpx.DecodeJSON(recorder, request, &target)

	require.Error(t, err)
	var maxErr *http.MaxBytesError
	assert.True(t, errors.As(err, &maxErr), "expected a *http.MaxBytesError, got %T: %v", err, err)
}

func TestDecodeJSONRejectsMalformedJSONWithoutClaimingItIsTooLarge(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("{not json"))
	recorder := httptest.NewRecorder()

	var target map[string]any
	err := httpx.DecodeJSON(recorder, request, &target)

	require.Error(t, err)
	var maxErr *http.MaxBytesError
	assert.False(t, errors.As(err, &maxErr))
}

func TestDecodeJSONRejectsUnknownFields(t *testing.T) {
	t.Parallel()

	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"unknown":"x"}`))
	recorder := httptest.NewRecorder()

	var target struct{}
	err := httpx.DecodeJSON(recorder, request, &target)

	assert.Error(t, err)
}
