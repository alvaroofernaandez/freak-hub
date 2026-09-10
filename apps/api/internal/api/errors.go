package api

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/upstream"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// errNoLocalMember is the detail every users.ErrNotFound mapping shares: the
// four call sites that could hit it (me, patchMe, uploadAvatar,
// resolveCaller) all mean exactly the same thing, so the Spanish prose is
// written once instead of four times.
const errNoLocalMember = "La sesión es válida pero todavía no hay ficha de miembro."

// errorRule maps one domain sentinel error onto its transport shape
// (ADR-0014 §2): one table instead of the three per-handler switches this
// package used to have (writeProfileUpdateError, writeAvatarUploadError,
// writeInvitationError).
type errorRule struct {
	sentinel error
	status   int
	code     httpx.ErrorCode
	detail   string
}

var errorRules = []errorRule{
	{users.ErrNotFound, http.StatusNotFound, httpx.CodeUnknownIdentity, errNoLocalMember},
	{users.ErrNoProfileChanges, http.StatusUnprocessableEntity, httpx.CodeNoProfileChanges,
		"Indica al menos un campo para actualizar."},
	{users.ErrNameTooLong, http.StatusUnprocessableEntity, httpx.CodeNameTooLong,
		"El nombre y los apellidos no pueden superar los 100 caracteres."},
	{users.ErrUsernameInvalidLength, http.StatusUnprocessableEntity, httpx.CodeUsernameInvalidLength,
		"El nombre de usuario debe tener entre 3 y 24 caracteres."},
	{users.ErrUsernameNumericOnly, http.StatusUnprocessableEntity, httpx.CodeUsernameNumericOnly,
		"El nombre de usuario no puede ser solo números."},
	{users.ErrUsernameTaken, http.StatusConflict, httpx.CodeUsernameTaken,
		"Ese nombre de usuario ya está en uso."},
	{users.ErrAvatarUnsupportedType, http.StatusUnsupportedMediaType, httpx.CodeAvatarUnsupportedType,
		"La imagen debe ser JPEG, PNG, WEBP o GIF."},
	{users.ErrAvatarTooLarge, http.StatusRequestEntityTooLarge, httpx.CodeAvatarTooLarge,
		"La imagen no puede superar los 5 MB."},
	{users.ErrInvalidLimit, http.StatusBadRequest, httpx.CodeInvalidLimit,
		"El parámetro limit debe estar entre 1 y 100."},
	{invitations.ErrInvalidEmail, http.StatusUnprocessableEntity, httpx.CodeInvalidEmail,
		"El correo no es válido."},
	{invitations.ErrAlreadySent, http.StatusConflict, httpx.CodeInvitationAlreadySent,
		"Ya hay una invitación pendiente para ese correo."},
	{invitations.ErrAlreadyMember, http.StatusConflict, httpx.CodeAlreadyMember,
		"Ese correo ya pertenece a un miembro."},
	{invitations.ErrInvalidLimit, http.StatusBadRequest, httpx.CodeInvalidLimit,
		"El parámetro limit debe estar entre 1 y 100."},
}

// fail is the single place every handler answers a domain or adapter error
// through — replacing the per-handler writeXError functions and writeInternal.
// op names the operation for the log line.
//
// Order matters and is deliberate (ADR-0014 §2): a domain sentinel from
// errorRules always wins over the generic fallbacks below it. Then, in
// order: a client that went away (context.Canceled) is not logged as an
// error and gets no meaningful body; a deadline we imposed
// (context.DeadlineExceeded) is a timeout; a downstream dependency marked by
// an adapter (upstream.ErrUnavailable) is transiently unavailable; anything
// else is an opaque internal_error, with the real cause only ever reaching
// the log.
func (h *handlers) fail(w http.ResponseWriter, r *http.Request, op string, err error) {
	if errors.Is(err, context.Canceled) {
		return
	}

	for _, rule := range errorRules {
		if errors.Is(err, rule.sentinel) {
			httpx.WriteProblem(w, r, rule.status, rule.code, rule.detail)
			return
		}
	}

	if errors.Is(err, context.DeadlineExceeded) {
		httpx.WriteProblem(w, r, http.StatusGatewayTimeout, httpx.CodeRequestTimeout,
			"La operación ha tardado demasiado. Puedes reintentarlo.")
		return
	}

	if errors.Is(err, upstream.ErrUnavailable) {
		opts := []httpx.ProblemOption{}
		if after, ok := upstream.RetryAfterFrom(err); ok {
			opts = append(opts, httpx.WithRetryAfterSeconds(int(after.Seconds())))
		}

		httpx.WriteProblem(w, r, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable,
			"Un servicio externo no está disponible. Puedes reintentarlo en unos segundos.", opts...)

		return
	}

	slog.ErrorContext(r.Context(), "request failed",
		slog.String("operation", op),
		slog.String("path", r.URL.Path),
		slog.Any("error", err))

	httpx.WriteProblem(w, r, http.StatusInternalServerError, httpx.CodeInternal,
		"Algo ha fallado por nuestra parte.")
}

// decodeJSON reads and validates a JSON body via httpx.DecodeJSON, writing
// the response itself and reporting false when it could not: a body over
// the cap becomes 413 payload_too_large, anything else malformed becomes
// 400 invalid_payload.
func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if err := httpx.DecodeJSON(w, r, target); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			httpx.WriteProblem(w, r, http.StatusRequestEntityTooLarge, httpx.CodePayloadTooLarge,
				"El cuerpo de la petición es demasiado grande.")
			return false
		}

		httpx.WriteProblem(w, r, http.StatusBadRequest, httpx.CodeInvalidPayload,
			"El cuerpo de la petición no es válido.")
		return false
	}

	return true
}
