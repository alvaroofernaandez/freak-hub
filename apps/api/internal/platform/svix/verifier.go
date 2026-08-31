// Package svix adapts Svix signature verification to the webhooks port. Clerk
// signs every delivery with Svix, so this is what proves a webhook is genuinely
// from Clerk and not from anyone who found the URL.
package svix

import (
	"fmt"
	"net/http"

	svix "github.com/svix/svix-webhooks/go"
)

// Verifier checks the Svix signature headers of a webhook delivery.
type Verifier struct {
	webhook *svix.Webhook
}

// NewVerifier builds a verifier from the endpoint signing secret.
func NewVerifier(signingSecret string) (*Verifier, error) {
	webhook, err := svix.NewWebhook(signingSecret)
	if err != nil {
		return nil, fmt.Errorf("build svix webhook verifier: %w", err)
	}

	return &Verifier{webhook: webhook}, nil
}

// Verify implements webhooks.SignatureVerifier. Svix enforces the timestamp
// tolerance itself, which is what stops a captured payload being replayed.
func (v *Verifier) Verify(payload []byte, headers http.Header) error {
	return v.webhook.Verify(payload, headers)
}
