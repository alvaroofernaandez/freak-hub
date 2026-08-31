package invitations

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"

	"github.com/google/uuid"
)

// ServiceDeps are the collaborators the use cases need.
type ServiceDeps struct {
	Sender     Sender
	Repository Repository
	Members    MemberDirectory
	// RedirectURL is where Clerk sends the invitee once they click the email.
	RedirectURL string
}

// Service holds the invitation use cases.
type Service struct {
	sender      Sender
	repo        Repository
	members     MemberDirectory
	redirectURL string
}

// NewService builds the invitation use cases from its collaborators.
func NewService(deps ServiceDeps) *Service {
	return &Service{
		sender:      deps.Sender,
		repo:        deps.Repository,
		members:     deps.Members,
		redirectURL: deps.RedirectURL,
	}
}

// Invite sends an invitation on behalf of an existing member.
//
// Order matters: everything that can reject the request is checked before Clerk
// is called, so a refused invitation never leaves an email in somebody's inbox,
// and the local row is only written once Clerk confirms the send.
func (s *Service) Invite(ctx context.Context, inviterID uuid.UUID, rawEmail string) (Invitation, error) {
	if inviterID == uuid.Nil {
		return Invitation{}, ErrMissingInviter
	}

	email, err := normaliseEmail(rawEmail)
	if err != nil {
		return Invitation{}, err
	}

	alreadyMember, err := s.members.ExistsByEmail(ctx, email)
	if err != nil {
		return Invitation{}, fmt.Errorf("check existing member for %s: %w", email, err)
	}
	if alreadyMember {
		return Invitation{}, ErrAlreadyMember
	}

	switch _, err := s.repo.PendingByEmail(ctx, email); {
	case err == nil:
		return Invitation{}, ErrAlreadySent
	case errors.Is(err, ErrNotFound):
		// Nothing pending: carry on.
	default:
		return Invitation{}, fmt.Errorf("look up pending invitation for %s: %w", email, err)
	}

	clerkInvitationID, err := s.sender.Send(ctx, email, s.redirectURL)
	if err != nil {
		return Invitation{}, fmt.Errorf("send invitation to %s: %w", email, err)
	}

	invitation, err := s.repo.Create(ctx, Invitation{
		ClerkInvitationID: clerkInvitationID,
		Email:             email,
		InviterID:         inviterID,
		Status:            StatusPending,
	})
	if err != nil {
		// Clerk already sent the email; surface the failure so the operator can
		// reconcile instead of pretending nothing happened.
		return Invitation{}, fmt.Errorf("record invitation %s for %s: %w", clerkInvitationID, email, err)
	}

	return invitation, nil
}

// ListMine returns the invitations a member has sent.
func (s *Service) ListMine(ctx context.Context, inviterID uuid.UUID) ([]Invitation, error) {
	if inviterID == uuid.Nil {
		return nil, ErrMissingInviter
	}

	return s.repo.ListByInviter(ctx, inviterID)
}

// MarkAccepted closes the loop when Clerk reports the invitation was used.
func (s *Service) MarkAccepted(ctx context.Context, rawEmail string) error {
	email, err := normaliseEmail(rawEmail)
	if err != nil {
		return err
	}

	return s.repo.MarkAccepted(ctx, email)
}

// normaliseEmail lower-cases and validates the address, so the same person can
// never hold two pending invitations under different capitalisations.
func normaliseEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" {
		return "", ErrInvalidEmail
	}

	address, err := mail.ParseAddress(email)
	if err != nil || address.Address != email {
		return "", ErrInvalidEmail
	}

	local, domain, found := strings.Cut(email, "@")
	if !found || local == "" || !strings.Contains(domain, ".") {
		return "", ErrInvalidEmail
	}

	return email, nil
}
