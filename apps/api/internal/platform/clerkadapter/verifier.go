// Package clerkadapter contains the outbound adapters that talk to Clerk: the
// session verifier, the invitation sender and the webhook decoder. Nothing in
// internal/auth, internal/users or internal/invitations imports the Clerk SDK,
// so the domain stays testable without network access.
package clerkadapter

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2/jwt"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/auth"
)

// Verifier validates Clerk session tokens against Clerk's JWKS.
//
// The SDK caches the key set internally, so verification is a local signature
// check after the first call rather than a network round trip per request.
type Verifier struct {
	// AuthorizedParty is the origin allowed to mint tokens for this API. When
	// set, a token issued for another front end is rejected even if its
	// signature is valid.
	AuthorizedParty string
}

// NewVerifier builds a session verifier.
func NewVerifier(authorizedParty string) *Verifier {
	return &Verifier{AuthorizedParty: strings.TrimSpace(authorizedParty)}
}

// Verify implements auth.Verifier.
func (v *Verifier) Verify(ctx context.Context, token string) (auth.Identity, error) {
	params := &jwt.VerifyParams{Token: token}
	if v.AuthorizedParty != "" {
		params.AuthorizedPartyHandler = func(azp string) bool {
			return azp == v.AuthorizedParty
		}
	}

	claims, err := jwt.Verify(ctx, params)
	if err != nil {
		return auth.Identity{}, fmt.Errorf("verify clerk session token: %w", err)
	}

	if claims.Subject == "" {
		return auth.Identity{}, errors.New("clerk session token has no subject")
	}

	return auth.Identity{
		ClerkUserID: claims.Subject,
		SessionID:   claims.SessionID,
	}, nil
}
