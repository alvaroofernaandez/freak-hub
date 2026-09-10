package upstream_test

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/upstream"
)

func TestErrUnavailableIsFoundThroughAWrappedChain(t *testing.T) {
	t.Parallel()

	wrapped := fmt.Errorf("clerk api unavailable: %w", upstream.ErrUnavailable)

	assert.ErrorIs(t, wrapped, upstream.ErrUnavailable)
}

func TestRetryAfterFromReportsTheRecordedDelay(t *testing.T) {
	t.Parallel()

	base := fmt.Errorf("rate limited: %w", upstream.ErrUnavailable)
	carrying := upstream.WrapWithRetryAfter(base, 45*time.Second)

	after, ok := upstream.RetryAfterFrom(carrying)

	assert.True(t, ok)
	assert.Equal(t, 45*time.Second, after)
	assert.ErrorIs(t, carrying, upstream.ErrUnavailable, "wrapping with a retry delay must not break errors.Is")
}

func TestRetryAfterFromReportsFalseWhenNoneWasRecorded(t *testing.T) {
	t.Parallel()

	_, ok := upstream.RetryAfterFrom(errors.New("plain error"))

	assert.False(t, ok)
}
