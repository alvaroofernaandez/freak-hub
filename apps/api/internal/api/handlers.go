package api

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/auth"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

type handlers struct {
	users       *users.Service
	invitations *invitations.Service
}

func (h *handlers) health(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// memberResponse is the wire shape of a member. Keeping it separate from the
// domain entity means renaming a field internally never breaks a client.
type memberResponse struct {
	ID          string `json:"id"`
	ClerkUserID string `json:"clerk_user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}

func toMemberResponse(user users.User) memberResponse {
	return memberResponse{
		ID:          user.ID.String(),
		ClerkUserID: user.ClerkUserID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
	}
}

func (h *handlers) me(w http.ResponseWriter, r *http.Request) {
	identity, _ := auth.IdentityFrom(r.Context())

	user, err := h.users.ByClerkID(r.Context(), identity.ClerkUserID)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			// The session is valid but the user.created webhook has not landed
			// yet, or was missed. Say so explicitly instead of pretending it is
			// an auth problem.
			httpx.WriteError(w, http.StatusNotFound, httpx.CodeUnknownIdentity,
				"La sesión es válida pero todavía no hay ficha de miembro.")
			return
		}

		writeInternal(w, r, "load member", err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, toMemberResponse(user))
}

type invitationResponse struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Status    string `json:"status"`
	InviterID string `json:"inviter_id"`
	CreatedAt string `json:"created_at"`
}

func toInvitationResponse(invitation invitations.Invitation) invitationResponse {
	return invitationResponse{
		ID:        invitation.ID.String(),
		Email:     invitation.Email,
		Status:    string(invitation.Status),
		InviterID: invitation.InviterID.String(),
		CreatedAt: invitation.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

type createInvitationRequest struct {
	Email string `json:"email"`
}

func (h *handlers) createInvitation(w http.ResponseWriter, r *http.Request) {
	var payload createInvitationRequest
	if err := httpx.DecodeJSON(r, &payload); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidPayload,
			"El cuerpo de la petición no es válido.")
		return
	}

	inviter, ok := h.resolveCaller(w, r)
	if !ok {
		return
	}

	invitation, err := h.invitations.Invite(r.Context(), inviter.ID, payload.Email)
	if err != nil {
		writeInvitationError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, toInvitationResponse(invitation))
}

func (h *handlers) listInvitations(w http.ResponseWriter, r *http.Request) {
	inviter, ok := h.resolveCaller(w, r)
	if !ok {
		return
	}

	sent, err := h.invitations.ListMine(r.Context(), inviter.ID)
	if err != nil {
		writeInternal(w, r, "list invitations", err)
		return
	}

	items := make([]invitationResponse, 0, len(sent))
	for _, invitation := range sent {
		items = append(items, toInvitationResponse(invitation))
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

// resolveCaller turns the Clerk identity into the local member row, writing the
// error response itself when it cannot.
func (h *handlers) resolveCaller(w http.ResponseWriter, r *http.Request) (users.User, bool) {
	identity, _ := auth.IdentityFrom(r.Context())

	user, err := h.users.ByClerkID(r.Context(), identity.ClerkUserID)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, httpx.CodeUnknownIdentity,
				"La sesión es válida pero todavía no hay ficha de miembro.")
			return users.User{}, false
		}

		writeInternal(w, r, "resolve caller", err)

		return users.User{}, false
	}

	return user, true
}

func writeInvitationError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, invitations.ErrInvalidEmail):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "invalid_email",
			"El correo no es válido.")
	case errors.Is(err, invitations.ErrAlreadySent):
		httpx.WriteError(w, http.StatusConflict, "invitation_already_sent",
			"Ya hay una invitación pendiente para ese correo.")
	case errors.Is(err, invitations.ErrAlreadyMember):
		httpx.WriteError(w, http.StatusConflict, "already_member",
			"Ese correo ya pertenece a un miembro.")
	default:
		writeInternal(w, r, "create invitation", err)
	}
}

// writeInternal logs the real cause and returns an opaque message, so an
// internal failure never leaks infrastructure details to a client.
func writeInternal(w http.ResponseWriter, r *http.Request, operation string, err error) {
	slog.ErrorContext(r.Context(), "request failed",
		slog.String("operation", operation),
		slog.String("path", r.URL.Path),
		slog.Any("error", err))

	httpx.WriteError(w, http.StatusInternalServerError, httpx.CodeInternal,
		"Algo ha fallado por nuestra parte.")
}
