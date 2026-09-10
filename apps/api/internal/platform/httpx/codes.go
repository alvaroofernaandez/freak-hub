package httpx

// ErrorCode is the stable, machine-readable half of an error response.
// Clients branch on this; Title and Detail are for humans and may reword
// freely. The full catalogue lives in codeRegistry below, and
// packages/contracts/openapi.yaml enumerates the same set as the `code`
// property's enum — internal/api's contract parity test fails the moment
// they drift apart in either direction.
type ErrorCode string

// The error codes the API answers with. Clients branch on these; codeRegistry
// below is what WriteProblem consults for each one's title, default
// retryable flag and, where unambiguous, blamed field.
const (
	CodeMissingToken          ErrorCode = "missing_token"
	CodeInvalidToken          ErrorCode = "invalid_token"
	CodeUnauthorized          ErrorCode = "unauthorized"
	CodeUnknownIdentity       ErrorCode = "unknown_identity"
	CodeInvalidPayload        ErrorCode = "invalid_payload"
	CodeNotFound              ErrorCode = "not_found"
	CodeInternal              ErrorCode = "internal_error"
	CodeInvalidLimit          ErrorCode = "invalid_limit"
	CodeInvalidCursor         ErrorCode = "invalid_cursor"
	CodeNoProfileChanges      ErrorCode = "no_profile_changes"
	CodeNameTooLong           ErrorCode = "name_too_long"
	CodeUsernameInvalidLength ErrorCode = "username_invalid_length"
	CodeUsernameNumericOnly   ErrorCode = "username_numeric_only"
	CodeUsernameTaken         ErrorCode = "username_taken"
	CodeAvatarTooLarge        ErrorCode = "avatar_too_large"
	CodeAvatarUnsupportedType ErrorCode = "avatar_unsupported_type"
	CodeInvalidEmail          ErrorCode = "invalid_email"
	CodeInvitationAlreadySent ErrorCode = "invitation_already_sent"
	CodeAlreadyMember         ErrorCode = "already_member"
	CodeMethodNotAllowed      ErrorCode = "method_not_allowed"
	CodePayloadTooLarge       ErrorCode = "payload_too_large"
	CodeRequestTimeout        ErrorCode = "request_timeout"
	CodeUpstreamUnavailable   ErrorCode = "upstream_unavailable"
)

// codeInfo is what the registry knows about a code beyond its wire value:
// the generic title Problem.Title carries, whether the condition is
// transient by default (Problem.Retryable), and — only for the codes where
// it is unambiguous (ADR-0014) — the single request field it blames.
type codeInfo struct {
	Title     string
	Retryable bool
	Field     string
}

// codeRegistry is the single source of truth every ErrorCode is described
// from. Adding a code here is what makes WriteProblem able to answer with it
// and what the contract parity test checks openapi.yaml against.
var codeRegistry = map[ErrorCode]codeInfo{
	CodeMissingToken:          {Title: "Falta el token de sesión"},
	CodeInvalidToken:          {Title: "Sesión no válida"},
	CodeUnauthorized:          {Title: "No autorizado"},
	CodeUnknownIdentity:       {Title: "Ficha de miembro no encontrada"},
	CodeInvalidPayload:        {Title: "Cuerpo de la petición no válido"},
	CodeNotFound:              {Title: "Recurso no encontrado"},
	CodeInternal:              {Title: "Error interno del servidor"},
	CodeInvalidLimit:          {Title: "Parámetro limit no válido"},
	CodeInvalidCursor:         {Title: "Parámetro cursor no válido"},
	CodeNoProfileChanges:      {Title: "Sin cambios que aplicar"},
	CodeNameTooLong:           {Title: "Nombre demasiado largo"},
	CodeUsernameInvalidLength: {Title: "Longitud de usuario no válida", Field: "username"},
	CodeUsernameNumericOnly:   {Title: "Nombre de usuario no válido", Field: "username"},
	CodeUsernameTaken:         {Title: "Nombre de usuario en uso", Field: "username"},
	CodeAvatarTooLarge:        {Title: "Imagen demasiado grande", Field: "avatar"},
	CodeAvatarUnsupportedType: {Title: "Tipo de imagen no compatible", Field: "avatar"},
	CodeInvalidEmail:          {Title: "Correo no válido", Field: "email"},
	CodeInvitationAlreadySent: {Title: "Invitación ya enviada", Field: "email"},
	CodeAlreadyMember:         {Title: "Ya es miembro", Field: "email"},
	CodeMethodNotAllowed:      {Title: "Método no permitido"},
	CodePayloadTooLarge:       {Title: "Cuerpo de la petición demasiado grande"},
	CodeRequestTimeout:        {Title: "Tiempo de espera agotado", Retryable: true},
	CodeUpstreamUnavailable:   {Title: "Servicio externo no disponible", Retryable: true},
}

// Codes lists every registered error code. internal/api's contract parity
// test uses it to check packages/contracts/openapi.yaml's `code` enum
// matches this file exactly, in both directions.
func Codes() []ErrorCode {
	codes := make([]ErrorCode, 0, len(codeRegistry))
	for code := range codeRegistry {
		codes = append(codes, code)
	}

	return codes
}
