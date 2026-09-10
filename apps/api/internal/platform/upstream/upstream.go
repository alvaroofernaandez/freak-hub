// Package upstream is the neutral vocabulary a handler uses to ask "was this
// a downstream dependency being unavailable?" without knowing which
// dependency it was. An outbound adapter (clerkadapter, and any future one)
// classifies its own errors into it; internal/api and internal/auth only
// ever check against ErrUnavailable — never against anything Clerk-specific.
package upstream

import (
	"errors"
	"time"
)

// ErrUnavailable marks an error as a downstream dependency being transiently
// unreachable or overloaded: retrying later has a reasonable chance of
// succeeding. An adapter should wrap the real cause with %w so
// errors.Is(err, ErrUnavailable) still finds it, and so does the original
// error for anyone that needs it.
var ErrUnavailable = errors.New("upstream unavailable")

// retryAfterCarrier is satisfied by an error that knows how long the caller
// should wait before retrying.
type retryAfterCarrier interface {
	RetryAfter() time.Duration
}

type withRetryAfter struct {
	error
	after time.Duration
}

// WrapWithRetryAfter records a suggested retry delay (for instance, a 429's
// own Retry-After) alongside err. err should already carry ErrUnavailable in
// its chain; WrapWithRetryAfter does not add it.
func WrapWithRetryAfter(err error, after time.Duration) error {
	return &withRetryAfter{error: err, after: after}
}

func (w *withRetryAfter) Unwrap() error { return w.error }

func (w *withRetryAfter) RetryAfter() time.Duration { return w.after }

// RetryAfterFrom reports the suggested retry delay carried in err's chain, if
// any adapter recorded one via WrapWithRetryAfter.
func RetryAfterFrom(err error) (time.Duration, bool) {
	var carrier retryAfterCarrier
	if errors.As(err, &carrier) {
		return carrier.RetryAfter(), true
	}

	return 0, false
}
