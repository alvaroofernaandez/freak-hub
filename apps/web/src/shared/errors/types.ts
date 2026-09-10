import type { ApiProblem, ProblemCode } from "./problem";

/**
 * The states a failure can resolve to, independent of the HTTP status or
 * code that produced it (ADR-0014 §4). A page never branches on `status` or
 * compares backend text again — it branches on this.
 */
export type ErrorKind =
  | "session_expired"
  | "account_pending"
  | "access_denied"
  | "not_found"
  | "validation"
  | "conflict"
  | "payload_too_large"
  | "unsupported_media"
  | "rate_limited"
  | "timeout"
  | "service_unavailable"
  | "network"
  | "offline"
  | "unknown";

/** How much visual weight the state should carry. */
export type ErrorSeverity = "critical" | "warning" | "info";

/** The taxonomy of ADR-0014 §3: where in the page this failure lives. */
export type ErrorScope =
  | "global"
  | "module"
  | "page"
  | "section"
  | "operation"
  | "field";

export interface ErrorContext {
  /** What failed to load or save, in the word a person would use: "grupo",
   * "miembro", "perfil", "invitación", "obra", "categoría". */
  resource: string;
  operation: "load" | "submit";
  scope: ErrorScope;
  /** Whether repeating the exact same request is safe. Defaults to `true`
   * for `operation: "load"` (a GET) and `false` for `operation: "submit"` —
   * an invitation or a send is never retried blindly. */
  idempotent?: boolean;
  /** The submit named as a person would say it, in the infinitive: "enviar
   * la invitación". Submit copy uses it to say exactly what failed; without
   * it, the copy falls back to "guardar los cambios". */
  action?: string;
  /** Whether the page already has data to show behind this failure (a
   * section error) as opposed to nothing at all (a page error). */
  hasData?: boolean;
}

export type RecoveryAction =
  | { kind: "retry" }
  | { kind: "sign_in"; redirectUrl?: string }
  | { kind: "back"; href?: string; label?: string }
  | { kind: "none" };

export interface NormalizedAppError {
  kind: ErrorKind;
  severity: ErrorSeverity;
  scope: ErrorScope;
  /** The contract code this came from, or `"unknown"` for a code the
   * contract does not declare, or for a failure with no code at all
   * (network, offline, an unexpected JS exception). */
  code: ProblemCode;
  status?: number;
  retryable: boolean;
  retryAfter?: number;
  correlationId?: string;
  fieldErrors?: { field: string; code: string }[];
  copy: { title: string; description: string };
  recovery: RecoveryAction;
  /** A client navigation cancelling its own in-flight request. Never a
   * failure to report or show — `reportError` skips it, and a caller that
   * gets this back should usually just let the aborted operation fade. */
  cancelled?: boolean;
  /** The original `ApiProblem`, when this came from the API, for anything
   * that needs more than the normalized shape (rare — prefer `kind`). */
  problem?: ApiProblem;
}

export type CopyResolver = (context: ErrorContext) => {
  title: string;
  description: string;
};
