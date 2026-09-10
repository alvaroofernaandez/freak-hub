import type { ErrorKind, NormalizedAppError } from "./types";

/** Expected outcomes, not bugs: a validation failure, a 404, an account
 * still being provisioned, or a permission the person legitimately does not
 * have. Logging these would just be noise. */
const EXPECTED_KINDS = new Set<ErrorKind>([
  "validation",
  "not_found",
  "account_pending",
  "access_denied",
]);

export interface ReportErrorMeta {
  route?: string;
}

/**
 * Logs only what is actually unexpected, and only the fields that are safe
 * to log (never `copy`, never the raw `ApiProblem`, never backend prose):
 * `kind`, `code`, `status`, `scope`, `route`, `correlationId`.
 *
 * Console only, and only in development — there is no log-shipping service
 * this points to. A cancelled request (a navigation cancelling its own
 * fetch) is never reported: the caller asked for it.
 */
export function reportError(
  error: NormalizedAppError,
  meta: ReportErrorMeta = {},
): void {
  if (error.cancelled || EXPECTED_KINDS.has(error.kind)) {
    return;
  }

  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.error("[freak-hub] unexpected error", {
    kind: error.kind,
    code: error.code,
    status: error.status,
    scope: error.scope,
    route: meta.route,
    correlationId: error.correlationId,
  });
}
