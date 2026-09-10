package httpx_test

import (
	"bytes"
	"context"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
)

func TestRequestIDLogHandlerAddsRequestIDToARecordWithAContext(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	logger := slog.New(httpx.NewRequestIDLogHandler(slog.NewJSONHandler(&buf, nil)))

	ctx := httpx.ContextWithRequestID(context.Background(), "the-request-id")
	logger.ErrorContext(ctx, "something failed")

	assert.Contains(t, buf.String(), `"request_id":"the-request-id"`)
}

func TestRequestIDLogHandlerLeavesARecordWithoutARequestIDAlone(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	logger := slog.New(httpx.NewRequestIDLogHandler(slog.NewJSONHandler(&buf, nil)))

	logger.ErrorContext(context.Background(), "something failed")

	assert.NotContains(t, buf.String(), "request_id")
}

func TestRequestIDLogHandlerPreservesAttrsAcrossWith(t *testing.T) {
	t.Parallel()

	var buf bytes.Buffer
	logger := slog.New(httpx.NewRequestIDLogHandler(slog.NewJSONHandler(&buf, nil))).
		With(slog.String("component", "webhooks"))

	ctx := httpx.ContextWithRequestID(context.Background(), "the-request-id")
	logger.ErrorContext(ctx, "something failed")

	assert.Contains(t, buf.String(), `"component":"webhooks"`)
	assert.Contains(t, buf.String(), `"request_id":"the-request-id"`)
}
