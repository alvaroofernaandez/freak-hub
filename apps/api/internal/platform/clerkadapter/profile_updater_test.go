// This file breaks the package's usual "adapter without a test" convention
// (see sender.go, verifier.go) on purpose: isUsernameTakenError and
// displayNameFrom are pure translation logic with no network involved, so
// they are testable honestly, unlike UpdateProfile/UploadAvatar themselves,
// which call the Clerk SDK directly and have no fake HTTP client in this
// repo to stand in for it.
package clerkadapter

import (
	"errors"
	"net/http"
	"testing"

	clerk "github.com/clerk/clerk-sdk-go/v2"
	"github.com/stretchr/testify/assert"
)

func TestIsUsernameTakenError(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "409 conflict",
			err:  &clerk.APIErrorResponse{HTTPStatusCode: http.StatusConflict},
			want: true,
		},
		{
			name: "form_identifier_exists code",
			err:  &clerk.APIErrorResponse{Errors: []clerk.Error{{Code: "form_identifier_exists"}}},
			want: true,
		},
		{
			name: "not an APIErrorResponse at all",
			err:  errors.New("boom"),
			want: false,
		},
		{
			name: "unrelated validation error",
			err: &clerk.APIErrorResponse{
				HTTPStatusCode: http.StatusUnprocessableEntity,
				Errors:         []clerk.Error{{Code: "form_param_invalid"}},
			},
			want: false,
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			assert.Equal(t, tt.want, isUsernameTakenError(tt.err))
		})
	}
}

func TestDisplayNameFrom(t *testing.T) {
	t.Parallel()

	first := "Álvaro"
	last := "Fernández"
	blank := ""
	spaced := "  "

	cases := []struct {
		name      string
		firstName *string
		lastName  *string
		username  string
		want      string
	}{
		{name: "both names present", firstName: &first, lastName: &last, username: "alvaro", want: "Álvaro Fernández"},
		{name: "only first name", firstName: &first, lastName: nil, username: "alvaro", want: "Álvaro"},
		{name: "only last name", firstName: nil, lastName: &last, username: "alvaro", want: "Fernández"},
		{name: "neither name falls back to username", firstName: nil, lastName: nil, username: "alvaro", want: "alvaro"},
		{name: "blank names fall back to username", firstName: &blank, lastName: &blank, username: "alvaro", want: "alvaro"},
		{name: "whitespace-only names fall back to username", firstName: &spaced, lastName: &spaced, username: "alvaro", want: "alvaro"},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			assert.Equal(t, tt.want, displayNameFrom(tt.firstName, tt.lastName, tt.username))
		})
	}
}
