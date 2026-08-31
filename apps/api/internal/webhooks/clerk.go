// Package webhooks turns Clerk deliveries into domain calls.
//
// Clerk is the source of truth for accounts, so this is how a member ever gets
// a row in our database. Deliveries are at-least-once and can arrive out of
// order, which is why every handler here is idempotent.
package webhooks

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

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
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeBadRequest, "No se pudo leer el cuerpo.")
		return
	}

	// Authenticate before parsing: an unsigned delivery is not our traffic.
	if err := h.signature.Verify(payload, r.Header); err != nil {
		slog.WarnContext(r.Context(), "rejected clerk webhook", slog.Any("error", err))
		httpx.WriteError(w, http.StatusUnauthorized, httpx.CodeUnauthorized, "Firma no válida.")

		return
	}

	var event envelope
	if err := json.Unmarshal(payload, &event); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidPayload, "El evento no es JSON válido.")
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
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidPayload, "Datos de usuario no válidos.")
		return
	}

	email := payload.primaryEmail()

	_, err := h.users.EnsureFromClerk(r.Context(), users.ClerkProfile{
		ClerkUserID: payload.ID,
		Username:    payload.Username,
		DisplayName: payload.displayName(),
		AvatarURL:   payload.ImageURL,
		Email:       email,
	})
	if err != nil {
		if errors.Is(err, users.ErrMissingClerkID) || errors.Is(err, users.ErrInvalidUsername) {
			// Clerk sent something we cannot project. Retrying will not help,
			// so answer 422 rather than letting it loop forever on a 5xx.
			slog.WarnContext(r.Context(), "unprocessable clerk user event", slog.Any("error", err))
			httpx.WriteError(w, http.StatusUnprocessableEntity, httpx.CodeInvalidPayload,
				"El usuario de Clerk no tiene los datos mínimos.")

			return
		}

		writeRetryable(w, r, "ensure member from clerk", err)

		return
	}

	// Closing the invitation is bookkeeping: a failure here must not make Clerk
	// retry an event whose main effect already succeeded.
	if email != "" {
		if err := h.invitations.MarkAccepted(r.Context(), email); err != nil {
			slog.ErrorContext(r.Context(), "could not close invitation",
				slog.String("email", email), slog.Any("error", err))
		}
	}

	httpx.WriteJSON(w, http.StatusNoContent, nil)
}

func (h *ClerkHandler) handleUserDeleted(w http.ResponseWriter, r *http.Request, data json.RawMessage) {
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &payload); err != nil || payload.ID == "" {
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidPayload, "Datos de usuario no válidos.")
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

	httpx.WriteError(w, http.StatusInternalServerError, httpx.CodeInternal,
		"No se pudo procesar el evento.")
}
