package api

import (
	"errors"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strings"

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
	CreatedAt   string `json:"created_at"`
}

func toMemberResponse(user users.User) memberResponse {
	return memberResponse{
		ID:          user.ID.String(),
		ClerkUserID: user.ClerkUserID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
		CreatedAt:   user.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
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

// patchMeRequest is the body of PATCH /v1/me. It carries no identity field
// on purpose: the clerk_user_id always comes from the session
// (identity.ClerkUserID), never from the client — DisallowUnknownFields
// (httpx.DecodeJSON) rejects a request that tries to smuggle one in.
type patchMeRequest struct {
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Username  *string `json:"username"`
}

// patchMe edits the current member's own name and username. It never talks
// to Postgres directly: it asks users.Service.UpdateProfile, which talks to
// Clerk, and Clerk remains the source of truth.
func (h *handlers) patchMe(w http.ResponseWriter, r *http.Request) {
	identity, _ := auth.IdentityFrom(r.Context())

	var payload patchMeRequest
	if err := httpx.DecodeJSON(r, &payload); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidPayload,
			"El cuerpo de la petición no es válido.")
		return
	}

	updated, err := h.users.UpdateProfile(r.Context(), identity.ClerkUserID, users.ProfileUpdate{
		FirstName: payload.FirstName,
		LastName:  payload.LastName,
		Username:  payload.Username,
	})
	if err != nil {
		writeProfileUpdateError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, toMemberResponse(updated))
}

// writeProfileUpdateError maps the domain errors UpdateProfile can return
// onto HTTP, following the same switch-on-errors.Is style as
// writeInvitationError below.
func writeProfileUpdateError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, users.ErrNoProfileChanges):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "no_profile_changes",
			"Indica al menos un campo para actualizar.")
	case errors.Is(err, users.ErrNameTooLong):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "name_too_long",
			"El nombre y los apellidos no pueden superar los 100 caracteres.")
	case errors.Is(err, users.ErrUsernameInvalidLength):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "username_invalid_length",
			"El nombre de usuario debe tener entre 3 y 24 caracteres.")
	case errors.Is(err, users.ErrUsernameNumericOnly):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "username_numeric_only",
			"El nombre de usuario no puede ser solo números.")
	case errors.Is(err, users.ErrUsernameTaken):
		httpx.WriteError(w, http.StatusConflict, "username_taken",
			"Ese nombre de usuario ya está en uso.")
	case errors.Is(err, users.ErrNotFound):
		httpx.WriteError(w, http.StatusNotFound, httpx.CodeUnknownIdentity,
			"La sesión es válida pero todavía no hay ficha de miembro.")
	default:
		writeInternal(w, r, "update profile", err)
	}
}

// uploadAvatar replaces the current member's profile image. Like patchMe, it
// never touches Postgres: users.Service.UploadAvatar talks to Clerk, and the
// user.updated webhook is what eventually persists the new avatar_url.
func (h *handlers) uploadAvatar(w http.ResponseWriter, r *http.Request) {
	identity, _ := auth.IdentityFrom(r.Context())

	// A little slack over users.MaxAvatarBytes for the multipart envelope
	// itself (boundaries, headers): the actual size check against
	// users.MaxAvatarBytes happens in the domain, against the file's own
	// size, not against this transport-level ceiling.
	const maxUploadBytes = users.MaxAvatarBytes + (1 << 20)

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)

	// The size gosec's G120 warns about is already bounded above by
	// http.MaxBytesReader, so maxUploadBytes here is a hard ceiling, not an
	// unbounded read.
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil { //nolint:gosec
		httpx.WriteError(w, http.StatusRequestEntityTooLarge, "avatar_too_large",
			"La imagen no puede superar los 5 MB.")
		return
	}
	defer func() {
		_ = r.MultipartForm.RemoveAll()
	}()

	files := r.MultipartForm.File["file"]
	if len(files) == 0 {
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidPayload,
			"Falta el archivo de la imagen.")
		return
	}

	fileHeader := files[0]

	file, err := fileHeader.Open()
	if err != nil {
		writeInternal(w, r, "open avatar upload", err)
		return
	}
	defer func() {
		_ = file.Close()
	}()

	contentType, err := sniffContentType(file)
	if err != nil {
		writeInternal(w, r, "sniff avatar content type", err)
		return
	}

	updated, err := h.users.UploadAvatar(r.Context(), identity.ClerkUserID, file, contentType, fileHeader.Size)
	if err != nil {
		writeAvatarUploadError(w, r, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, toMemberResponse(updated))
}

// sniffContentType detects the MIME type from the file's own bytes
// (http.DetectContentType), never from the Content-Type the client declared
// in the multipart part — a client-declared MIME type is not something to
// trust for a security decision like which files are accepted.
func sniffContentType(file multipart.File) (string, error) {
	buf := make([]byte, 512)

	n, err := file.Read(buf)
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	contentType := http.DetectContentType(buf[:n])
	if idx := strings.Index(contentType, ";"); idx != -1 {
		contentType = contentType[:idx]
	}

	return contentType, nil
}

func writeAvatarUploadError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, users.ErrAvatarUnsupportedType):
		httpx.WriteError(w, http.StatusUnsupportedMediaType, "avatar_unsupported_type",
			"La imagen debe ser JPEG, PNG, WEBP o GIF.")
	case errors.Is(err, users.ErrAvatarTooLarge):
		httpx.WriteError(w, http.StatusRequestEntityTooLarge, "avatar_too_large",
			"La imagen no puede superar los 5 MB.")
	case errors.Is(err, users.ErrNotFound):
		httpx.WriteError(w, http.StatusNotFound, httpx.CodeUnknownIdentity,
			"La sesión es válida pero todavía no hay ficha de miembro.")
	default:
		writeInternal(w, r, "upload avatar", err)
	}
}

// listMembers answers the group roster, keyset-paginated per ADR-0011.
func (h *handlers) listMembers(w http.ResponseWriter, r *http.Request) {
	limit, err := httpx.ParseLimit(r.URL.Query().Get("limit"), users.DefaultListLimit)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidLimit,
			"El parámetro limit no es válido.")
		return
	}

	var after *users.Cursor
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		decoded, err := httpx.DecodeCursor(raw)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidCursor,
				"El parámetro cursor no es válido.")
			return
		}

		after = &users.Cursor{CreatedAt: decoded.CreatedAt, ID: decoded.ID}
	}

	members, next, err := h.users.List(r.Context(), after, limit)
	if err != nil {
		if errors.Is(err, users.ErrInvalidLimit) {
			httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidLimit,
				"El parámetro limit debe estar entre 1 y 100.")
			return
		}

		writeInternal(w, r, "list members", err)
		return
	}

	items := make([]memberResponse, 0, len(members))
	for _, member := range members {
		items = append(items, toMemberResponse(member))
	}

	var nextCursor *string
	if next != nil {
		encoded := httpx.EncodeCursor(httpx.PageCursor{CreatedAt: next.CreatedAt, ID: next.ID})
		nextCursor = &encoded
	}

	httpx.WriteJSON(w, http.StatusOK, httpx.Page[memberResponse]{Items: items, NextCursor: nextCursor})
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

type inviterResponse struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}

type groupInvitationResponse struct {
	ID        string          `json:"id"`
	Email     string          `json:"email"`
	Status    string          `json:"status"`
	CreatedAt string          `json:"created_at"`
	Inviter   inviterResponse `json:"inviter"`
}

func toGroupInvitationResponse(entry invitations.GroupEntry) groupInvitationResponse {
	return groupInvitationResponse{
		ID:        entry.ID.String(),
		Email:     entry.Email,
		Status:    string(entry.Status),
		CreatedAt: entry.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		Inviter: inviterResponse{
			ID:          entry.Inviter.ID.String(),
			Username:    entry.Inviter.Username,
			DisplayName: entry.Inviter.DisplayName,
			AvatarURL:   entry.Inviter.AvatarURL,
		},
	}
}

// listGroupInvitations answers every invitation the group has ever sent,
// including who sent it, keyset-paginated per ADR-0011. Unlike listInvitations
// (scoped to the caller), any member can see the whole trail — it is what
// lets two members notice they are about to invite the same address, and
// lets the "invitados pendientes" screen show who is still missing.
func (h *handlers) listGroupInvitations(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.resolveCaller(w, r); !ok {
		return
	}

	limit, err := httpx.ParseLimit(r.URL.Query().Get("limit"), invitations.DefaultListLimit)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidLimit,
			"El parámetro limit no es válido.")
		return
	}

	var after *invitations.Cursor
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		decoded, err := httpx.DecodeCursor(raw)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidCursor,
				"El parámetro cursor no es válido.")
			return
		}

		after = &invitations.Cursor{CreatedAt: decoded.CreatedAt, ID: decoded.ID}
	}

	entries, next, err := h.invitations.ListGroup(r.Context(), after, limit)
	if err != nil {
		if errors.Is(err, invitations.ErrInvalidLimit) {
			httpx.WriteError(w, http.StatusBadRequest, httpx.CodeInvalidLimit,
				"El parámetro limit debe estar entre 1 y 100.")
			return
		}

		writeInternal(w, r, "list group invitations", err)
		return
	}

	items := make([]groupInvitationResponse, 0, len(entries))
	for _, entry := range entries {
		items = append(items, toGroupInvitationResponse(entry))
	}

	var nextCursor *string
	if next != nil {
		encoded := httpx.EncodeCursor(httpx.PageCursor{CreatedAt: next.CreatedAt, ID: next.ID})
		nextCursor = &encoded
	}

	httpx.WriteJSON(w, http.StatusOK, httpx.Page[groupInvitationResponse]{Items: items, NextCursor: nextCursor})
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
