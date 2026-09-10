package clerkadapter

import (
	"context"
	"errors"
	"net"
	"net/http"
	"testing"

	clerk "github.com/clerk/clerk-sdk-go/v2"
	"github.com/stretchr/testify/assert"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/upstream"
)

type fakeTimeoutError struct{}

func (fakeTimeoutError) Error() string   { return "dial tcp: i/o timeout" }
func (fakeTimeoutError) Timeout() bool   { return true }
func (fakeTimeoutError) Temporary() bool { return true }

func TestClassifyUpstreamMarksA429AsUnavailable(t *testing.T) {
	t.Parallel()

	err := classifyUpstream("update clerk user", &clerk.APIErrorResponse{HTTPStatusCode: http.StatusTooManyRequests})

	assert.ErrorIs(t, err, upstream.ErrUnavailable)
}

func TestClassifyUpstreamMarksA5xxAsUnavailable(t *testing.T) {
	t.Parallel()

	err := classifyUpstream("update clerk user", &clerk.APIErrorResponse{HTTPStatusCode: http.StatusBadGateway})

	assert.ErrorIs(t, err, upstream.ErrUnavailable)
}

func TestClassifyUpstreamLeavesAValidated4xxAlone(t *testing.T) {
	t.Parallel()

	err := classifyUpstream("update clerk user", &clerk.APIErrorResponse{
		HTTPStatusCode: http.StatusUnprocessableEntity,
		Errors:         []clerk.Error{{Code: "form_param_invalid"}},
	})

	assert.NotErrorIs(t, err, upstream.ErrUnavailable)
}

func TestClassifyUpstreamMarksANetworkTimeoutAsUnavailable(t *testing.T) {
	t.Parallel()

	err := classifyUpstream("verify clerk session token", fakeTimeoutError{})

	assert.ErrorIs(t, err, upstream.ErrUnavailable)
}

func TestClassifyUpstreamMarksARealNetOpErrorAsUnavailable(t *testing.T) {
	t.Parallel()

	opErr := &net.OpError{Op: "dial", Err: errors.New("connection refused")}

	err := classifyUpstream("create clerk invitation", opErr)

	assert.ErrorIs(t, err, upstream.ErrUnavailable)
}

func TestClassifyUpstreamPrioritisesContextDeadlineOverUpstreamClassification(t *testing.T) {
	t.Parallel()

	err := classifyUpstream("verify clerk session token", context.DeadlineExceeded)

	// classifyUpstream still tags it as upstream-unavailable (context.DeadlineExceeded
	// implements net.Error.Timeout()), but the chain must still resolve to
	// context.DeadlineExceeded too, so a caller that checks that first (as
	// internal/api's fail() does) classifies it as a timeout, not a 503.
	assert.ErrorIs(t, err, context.DeadlineExceeded)
}

func TestClassifyUpstreamReturnsNilForNil(t *testing.T) {
	t.Parallel()

	assert.NoError(t, classifyUpstream("op", nil))
}

func TestClassifyUpstreamKeepsTheOperationPrefixOnAPlainError(t *testing.T) {
	t.Parallel()

	err := classifyUpstream("do the thing", errors.New("boom"))

	assert.ErrorContains(t, err, "do the thing")
	assert.NotErrorIs(t, err, upstream.ErrUnavailable)
}
