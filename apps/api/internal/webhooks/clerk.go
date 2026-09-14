// Package webhooks turns Clerk deliveries into domain calls.
//
// Clerk is the source of truth for accounts, so this is how a member ever gets
// a row in our database. Deliveries are at-least-once and can arrive out of
// order, which is why every handler here is idempotent.
package webhooks

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// SignatureVerifier authenticates a webhook delivery. The Svix adapter
// implements it; the tests use a stub.
type SignatureVerifier interface {
	Verify(payload []byte, headers http.Header) error
}

// ClerkDeps are the collaborators the webhook handler needs.
type ClerkDeps struct {
	Signature   SignatureVerifier
	Users       *users.Service
	Invitations *invitations.Service
}

// ClerkHandler handles POST /webhooks/clerk.
type ClerkHandler struct {
	signature   SignatureVerifier
	users       *users.Service
	invitations *invitations.Service
}

// NewClerkHandler builds the handler for POST /webhooks/clerk.
func NewClerkHandler(deps ClerkDeps) *ClerkHandler {
	return &ClerkHandler{
		signature:   deps.Signature,
		users:       deps.Users,
		invitations: deps.Invitations,
	}
}

// maxWebhookBody caps a delivery at 1 MiB; Clerk payloads are a few KiB.
const maxWebhookBody = 1 << 20

type envelope struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type clerkUser struct {
	ID                    string `json:"id"`
	Username              string `json:"username"`
	FirstName             string `json:"first_name"`
	LastName              string `json:"last_name"`
	ImageURL              string `json:"image_url"`
	PrimaryEmailAddressID string `json:"primary_email_address_id"`
	EmailAddresses        []struct {
		ID           string `json:"id"`
		EmailAddress string `json:"email_address"`
	} `json:"email_addresses"`
}

// primaryEmail returns the address Clerk marked as primary, falling back to the
// first one when the pointer is absent.
func (u clerkUser) primaryEmail() string {
	for _, address := range u.EmailAddresses {
		if address.ID == u.PrimaryEmailAddressID {
			return address.EmailAddress
		}
	}

	if len(u.EmailAddresses) > 0 {
		return u.EmailAddresses[0].EmailAddress
	}

	return ""
}

func (u clerkUser) displayName() string {
	full := strings.TrimSpace(strings.TrimSpace(u.FirstName) + " " + strings.TrimSpace(u.LastName))
	if full != "" {
		return full
	}

	return strings.TrimSpace(u.Username)
}

func (h *ClerkHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	payload, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxWebhookBody))
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			httpx.WriteProblem(w, r, http.StatusRequestEntityTooLarge, httpx.CodePayloadTooLarge,
				"El cuerpo de la petición es demasiado grande.")
			return
		}

		httpx.WriteProblem(w, r, http.StatusBadRequest, httpx.CodeInvalidPayload, "No se pudo leer el cuerpo.")
		return
	}

	// Authenticate before parsing: an unsigned delivery is not our traffic.
	if err := h.signature.Verify(payload, r.Header); err != nil {
		slog.WarnContext(r.Context(), "rejected clerk webhook", slog.Any("error", err))
		httpx.WriteProblem(w, r, http.StatusUnauthorized, httpx.CodeUnauthorized, "Firma no válida.")

		return
	}

	var event envelope
	if err := json.Unmarshal(payload, &event); err != nil {
		httpx.WriteProblem(w, r, http.StatusBadRequest, httpx.CodeInvalidPayload, "El evento no es JSON válido.")
		return
	}

	switch event.Type {
	case "user.created", "user.updated":
		h.handleUserUpserted(w, r, event.Data)
	case "user.deleted":
		h.handleUserDeleted(w, r, event.Data)
	default:
		// Unknown event types are acknowledged so Clerk stops retrying them.
		slog.DebugContext(r.Context(), "ignoring clerk event", slog.String("type", event.Type))
		httpx.WriteJSON(w, http.StatusNoContent, nil)
	}
}

func (h *ClerkHandler) handleUserUpserted(w http.ResponseWriter, r *http.Request, data json.RawMessage) {
	var payload clerkUser
	if err := json.Unmarshal(data, &payload); err != nil {
		httpx.WriteProblem(w, r, http.StatusBadRequest, httpx.CodeInvalidPayload, "Datos de usuario no válidos.")
		return
	}

	email := payload.primaryEmail()

	// Read who invited this account before projecting it: members.invited_by
	// can only be written by the INSERT below, because the upsert deliberately
	// leaves that column alone on conflict. Reading is all that happens here —
	// the invitation is not consumed until the member exists.
	invitedBy := h.inviterFor(r.Context(), email)

	_, err := h.users.EnsureFromClerk(r.Context(), users.ClerkProfile{
		ClerkUserID: payload.ID,
		Username:    payload.Username,
		DisplayName: payload.displayName(),
		AvatarURL:   payload.ImageURL,
		Email:       email,
		InvitedBy:   invitedBy,
	})
	if err != nil {
		if errors.Is(err, users.ErrMissingClerkID) || errors.Is(err, users.ErrInvalidUsername) {
			// Clerk sent something we cannot project. Retrying will not help,
			// so answer 422 rather than letting it loop forever on a 5xx.
			slog.WarnContext(r.Context(), "unprocessable clerk user event", slog.Any("error", err))
			httpx.WriteProblem(w, r, http.StatusUnprocessableEntity, httpx.CodeInvalidPayload,
				"El usuario de Clerk no tiene los datos mínimos.")

			return
		}

		writeRetryable(w, r, "ensure member from clerk", err)

		return
	}

	// Only now, with the member stored, is the invitation consumed. Had this
	// delivery failed (500) or been rejected (422), the invitation would still
	// be pending and the delivery that finally succeeds would record the
	// inviter just the same.
	h.closeInvitation(r.Context(), email)

	httpx.WriteJSON(w, http.StatusNoContent, nil)
}

// inviterFor reports who invited the account behind an address, or nil when
// there is nobody to point at. It only reads.
//
// Nil is the ordinary answer, not a failure: founders and accounts created by
// hand in Clerk never had an invitation, and a redelivery finds the one an
// earlier delivery already closed — in which case the member already carries
// the inviter and the upsert will not touch it.
func (h *ClerkHandler) inviterFor(ctx context.Context, email string) *uuid.UUID {
	if email == "" {
		return nil
	}

	invitation, err := h.invitations.PendingByEmail(ctx, email)
	switch {
	case errors.Is(err, invitations.ErrNotFound):
		slog.DebugContext(ctx, "no pending invitation for this account", slog.String("email", email))

		return nil
	case err != nil:
		slog.ErrorContext(ctx, "could not look up the pending invitation",
			slog.String("email", email), slog.Any("error", err))

		return nil
	}

	// A nil inviter would be a broken row: members.invited_by is a foreign key,
	// and pointing it at the zero uuid would fail the insert for everyone.
	if invitation.InviterID == uuid.Nil {
		return nil
	}

	inviter := invitation.InviterID

	return &inviter
}

// closeInvitation marks the invitation accepted once the member it belongs to
// exists. It is bookkeeping: a failure here is logged and swallowed, because
// the event's main effect already succeeded and making Clerk retry would only
// repeat it.
func (h *ClerkHandler) closeInvitation(ctx context.Context, email string) {
	if email == "" {
		return
	}

	if err := h.invitations.MarkAccepted(ctx, email); err != nil {
		slog.ErrorContext(ctx, "could not close invitation",
			slog.String("email", email), slog.Any("error", err))
	}
}

func (h *ClerkHandler) handleUserDeleted(w http.ResponseWriter, r *http.Request, data json.RawMessage) {
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &payload); err != nil || payload.ID == "" {
		httpx.WriteProblem(w, r, http.StatusBadRequest, httpx.CodeInvalidPayload, "Datos de usuario no válidos.")
		return
	}

	if err := h.users.DeleteByClerkID(r.Context(), payload.ID); err != nil {
		writeRetryable(w, r, "delete member", err)
		return
	}

	httpx.WriteJSON(w, http.StatusNoContent, nil)
}

// writeRetryable answers 500 on purpose: Clerk retries 5xx deliveries, which is
// exactly what we want when the failure is ours (database down, for instance).
func writeRetryable(w http.ResponseWriter, r *http.Request, operation string, err error) {
	slog.ErrorContext(r.Context(), "webhook failed",
		slog.String("operation", operation), slog.Any("error", err))

	httpx.WriteProblem(w, r, http.StatusInternalServerError, httpx.CodeInternal,
		"No se pudo procesar el evento.")
}
