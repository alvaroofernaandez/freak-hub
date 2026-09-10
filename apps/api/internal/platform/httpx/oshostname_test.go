package httpx_test

import "os"

// osHostname is a thin indirection so requestid_test.go reads cleanly; it
// exists only so the hostname check has an obvious, greppable source.
func osHostname() (string, error) {
	return os.Hostname()
}
