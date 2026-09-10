package clerkadapter

import (
	"errors"
	"fmt"
	"net"
	"net/http"

	clerk "github.com/clerk/clerk-sdk-go/v2"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/upstream"
)

// classifyUpstream wraps err with upstream.ErrUnavailable when it looks like
// a transient failure of Clerk itself — rate limited, erroring on their
// side, or the network/a deadline never let the call reach them — rather
// than something about this particular request. Every other error (a
// validated 4xx, which callers such as isUsernameTakenError check for
// before this ever runs) passes through with just the op prefix.
//
// A context deadline surfacing here (net.Error.Timeout() is true for
// context.DeadlineExceeded too) still gets wrapped as ErrUnavailable, but
// that is harmless: it also still satisfies errors.Is(err,
// context.DeadlineExceeded), and internal/api's fail() checks that before
// checking upstream.ErrUnavailable, so it is classified as a timeout
// (504), not upstream_unavailable (503), exactly as ADR-0014 wants.
func classifyUpstream(op string, err error) error {
	if err == nil {
		return nil
	}

	var apiErr *clerk.APIErrorResponse
	if errors.As(err, &apiErr) {
		if apiErr.HTTPStatusCode == http.StatusTooManyRequests || apiErr.HTTPStatusCode >= http.StatusInternalServerError {
			return fmt.Errorf("%s: %w: %w", op, upstream.ErrUnavailable, err)
		}

		return fmt.Errorf("%s: %w", op, err)
	}

	var netErr net.Error
	if errors.As(err, &netErr) {
		return fmt.Errorf("%s: %w: %w", op, upstream.ErrUnavailable, err)
	}

	return fmt.Errorf("%s: %w", op, err)
}
