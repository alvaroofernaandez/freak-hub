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

// TestDecodeJSONRejectsASecondDocumentAfterTheFirst closes the other half of
// "no unknown fields": a decoder that reads one document and stops leaves
// whatever follows unread, so two concatenated bodies were a silent partial
// success. The field nobody expected and the document nobody read are the
// same mistake seen twice.
func TestDecodeJSONRejectsASecondDocumentAfterTheFirst(t *testing.T) {
	t.Parallel()

	var target struct {
		Title string `json:"title"`
	}

	err := decodeInto(t, `{"title":"a"}{"title":"b"}`, &target)

	require.Error(t, err, "a body of two documents is not a body this API accepts")
	assert.ErrorIs(t, err, httpx.ErrTrailingData)
}

func TestDecodeJSONAcceptsTrailingWhitespaceAfterTheDocument(t *testing.T) {
	t.Parallel()

	var target struct {
		Title string `json:"title"`
	}

	require.NoError(t, decodeInto(t, "{\"title\":\"a\"}\n  \t\n", &target),
		"a trailing newline is how most clients end a body")
	assert.Equal(t, "a", target.Title)
}

// decodeInto runs one body through DecodeJSON with a real ResponseWriter,
// which http.MaxBytesReader needs.
func decodeInto(t *testing.T, body string, target any) error {
	t.Helper()

	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))

	return httpx.DecodeJSON(httptest.NewRecorder(), request, target)
}
