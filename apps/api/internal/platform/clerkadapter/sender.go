package clerkadapter

import (
	"context"
	"fmt"

	"github.com/clerk/clerk-sdk-go/v2/invitation"
)

// InvitationSender creates invitations through the Clerk Backend API. Because
// the instance runs in `restricted` sign-up mode, this call is what actually
// unlocks registration for an email address.
type InvitationSender struct {
	client *invitation.Client
}

// NewInvitationSender builds the sender from an already configured Clerk client.
func NewInvitationSender(client *invitation.Client) *InvitationSender {
	return &InvitationSender{client: client}
}

// Send implements invitations.Sender.
func (s *InvitationSender) Send(ctx context.Context, email, redirectURL string) (string, error) {
	notify := true
	// Never silently absorb "this address already has an invitation": the domain
	// service decides what a duplicate means, not Clerk.
	ignoreExisting := false

	created, err := s.client.Create(ctx, &invitation.CreateParams{
		EmailAddress:   email,
		Notify:         &notify,
		IgnoreExisting: &ignoreExisting,
		RedirectURL:    &redirectURL,
	})
	if err != nil {
		return "", fmt.Errorf("create clerk invitation: %w", err)
	}

	return created.ID, nil
}
