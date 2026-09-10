import type { ProblemCode } from "./problem";
import type { CopyResolver, ErrorContext, ErrorKind } from "./types";

/** Clerk's own limits (also enforced client-side in
 * `features/profile/actions/update-profile.ts` before the API is ever
 * called). Lives here, not duplicated, so the copy and the check agree. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

/** The API's own avatar limits (`apps/api/internal/users.MaxAvatarBytes` /
 * `AllowedAvatarContentTypes`), mirrored here so the client can reject an
 * obviously invalid file before ever uploading it, with the exact same
 * outcome the server would reach. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

function fixed(title: string, description: string): CopyResolver {
  return () => ({ title, description });
}

/** The failed-submit sentence: the operation by name when the context gives
 * one ("No se ha podido enviar la invitación."), otherwise the profile's
 * long-standing wording. */
function submitFailure(context: ErrorContext): string {
  return context.action
    ? `No se ha podido ${context.action}.`
    : "No se han podido guardar los cambios.";
}

/** A deadline hit on a submit that is not safe to repeat leaves its outcome
 * unknown: it may have gone through just before the cut. The copy asks to
 * check first instead of inviting a blind retry (ADR-0014). */
function isUncertainSubmit(context: ErrorContext): boolean {
  return context.operation === "submit" && context.idempotent === false;
}

function uncertainSubmitCopy(context: ErrorContext): {
  title: string;
  description: string;
} {
  return {
    title: "No sabemos si se ha completado",
    description: context.action
      ? `No sabemos si se ha podido ${context.action}. Compruébalo antes de volver a intentarlo.`
      : "No sabemos si se han guardado los cambios. Compruébalo antes de volver a intentarlo.",
  };
}

/**
 * Display copy for every code the contract's `Error.code` enum declares,
 * plus `"unknown"`. `Record<ProblemCode, …>` is exhaustive: a code added to
 * the contract without an entry here fails the typecheck instead of
 * shipping with no copy.
 *
 * A resolver receives the operation's `ErrorContext` so the same code can
 * read naturally regardless of what failed to load or save ("no se ha
 * podido cargar el grupo" vs. "no se ha podido cargar tu perfil").
 *
 * Wording for `no_profile_changes`, `name_too_long`,
 * `username_invalid_length`, `username_numeric_only`, `username_taken`,
 * `avatar_too_large` and `avatar_unsupported_type` is moved here verbatim
 * from `features/profile/actions/update-profile.ts`'s old `MESSAGES`
 * constant; `invitation_already_sent`'s wording is moved from
 * `features/invitations/actions/create-invitation.ts`. Neither file changes
 * the meaning of its copy — they now read it from here.
 */
export const MESSAGES: Record<ProblemCode, CopyResolver> = {
  missing_token: fixed(
    "Tu sesión ha caducado",
    "Inicia sesión de nuevo para continuar.",
  ),
  invalid_token: fixed(
    "Tu sesión ha caducado",
    "Inicia sesión de nuevo para continuar.",
  ),
  unauthorized: fixed(
    "Tu sesión ha caducado",
    "Inicia sesión de nuevo para continuar.",
  ),
  unknown_identity: fixed(
    "Tu cuenta todavía no está lista",
    "Estamos terminando de preparar tu perfil. Vuelve a intentarlo en un momento.",
  ),
  invalid_payload: fixed(
    "Datos no válidos",
    "Revisa la información enviada e inténtalo de nuevo.",
  ),
  not_found: (context) => ({
    title: "No se ha encontrado",
    description: `No hemos encontrado ${context.resource}.`,
  }),
  internal_error: (context) => ({
    title: "Ha fallado algo en nuestro lado",
    description:
      context.operation === "submit"
        ? `${submitFailure(context)} Inténtalo de nuevo.`
        : `No se ha podido cargar ${context.resource}. Inténtalo de nuevo.`,
  }),
  invalid_limit: fixed(
    "No se ha podido cargar la lista",
    "Vuelve a intentarlo en un momento.",
  ),
  invalid_cursor: fixed(
    "No se ha podido cargar la lista",
    "Vuelve a intentarlo en un momento.",
  ),
  no_profile_changes: fixed(
    "Nada que guardar",
    "No has cambiado nada todavía.",
  ),
  name_too_long: fixed(
    "Nombre demasiado largo",
    "El nombre o los apellidos son demasiado largos.",
  ),
  username_invalid_length: fixed(
    "Nombre de usuario no válido",
    `El nombre de usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`,
  ),
  username_numeric_only: fixed(
    "Nombre de usuario no válido",
    "El nombre de usuario no puede ser solo números.",
  ),
  username_taken: fixed(
    "Nombre de usuario en uso",
    "Ese nombre de usuario ya está cogido. Prueba con otro.",
  ),
  avatar_too_large: fixed(
    "Foto demasiado pesada",
    "La foto pesa más de 5 MB. Prueba con una más ligera.",
  ),
  avatar_unsupported_type: fixed(
    "Formato no admitido",
    "Ese archivo no es una imagen válida.",
  ),
  invalid_email: fixed("Correo no válido", "Escribe un correo válido."),
  invitation_already_sent: fixed(
    "Invitación ya enviada",
    "Ya hay una invitación pendiente para ese correo.",
  ),
  already_member: fixed(
    "Ya es miembro",
    "Ese correo ya pertenece a alguien del grupo.",
  ),
  method_not_allowed: fixed(
    "Acción no disponible",
    "Esta acción no está disponible ahora mismo.",
  ),
  payload_too_large: fixed(
    "Archivo demasiado grande",
    "El archivo enviado supera el tamaño permitido.",
  ),
  request_timeout: (context) =>
    isUncertainSubmit(context)
      ? uncertainSubmitCopy(context)
      : {
          title: "La petición ha tardado demasiado",
          description: "Vuelve a intentarlo en un momento.",
        },
  upstream_unavailable: fixed(
    "Servicio no disponible",
    "No está disponible ahora mismo. Vuelve a intentarlo en unos minutos.",
  ),
  unknown: (context) => ({
    title: "No se ha podido completar la acción",
    description:
      context.operation === "submit"
        ? `${submitFailure(context)} Inténtalo de nuevo.`
        : `No se ha podido cargar ${context.resource}. Inténtalo de nuevo.`,
  }),
};

/** Copy for failures that never carry a contract `code` at all: the request
 * never reached the API. */
export const KIND_COPY: Partial<Record<ErrorKind, CopyResolver>> = {
  network: fixed(
    "No hay conexión con el servidor",
    "Comprueba tu conexión e inténtalo de nuevo.",
  ),
  offline: fixed("Sin conexión", "Lo que ves puede no estar al día."),
  rate_limited: fixed(
    "Demasiadas solicitudes",
    "Espera un momento antes de volver a intentarlo.",
  ),
  access_denied: fixed("No tienes acceso", "No tienes permiso para ver esto."),
  // A client-side deadline carries no contract code. Only a non-idempotent
  // submit needs its own wording; everything else keeps the generic copy.
  timeout: (context) =>
    isUncertainSubmit(context)
      ? uncertainSubmitCopy(context)
      : MESSAGES.unknown(context),
};

export function resolveCopy(
  code: ProblemCode,
  kind: ErrorKind,
  context: ErrorContext,
): { title: string; description: string } {
  const kindResolver = KIND_COPY[kind];
  if (kindResolver && (code === "unknown" || kind === "access_denied")) {
    return kindResolver(context);
  }
  return MESSAGES[code](context);
}
