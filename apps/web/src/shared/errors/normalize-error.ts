import {
  ApiAbortError,
  ApiError,
  ApiNetworkError,
  ApiProblemError,
  ApiTimeoutError,
} from "@/shared/lib/api-client";
import { resolveCopy } from "./messages";
import { type ApiProblem, type ProblemCode, parseProblem } from "./problem";
import type {
  ErrorContext,
  ErrorKind,
  ErrorSeverity,
  NormalizedAppError,
  RecoveryAction,
} from "./types";

function classify(problem: ApiProblem): ErrorKind {
  // A valid session with no `members` row yet is a different situation from
  // "this resource does not exist" — the identity is real, just not ready.
  if (problem.code === "unknown_identity") {
    return "account_pending";
  }

  switch (problem.status) {
    case 401:
      return "session_expired";
    case 403:
      return "access_denied";
    case 404:
      return "not_found";
    case 400:
    case 422:
      return "validation";
    case 409:
      return "conflict";
    case 413:
      return "payload_too_large";
    case 415:
      return "unsupported_media";
    case 429:
      return "rate_limited";
    case 504:
      return "timeout";
    case 502:
    case 503:
      return "service_unavailable";
    default:
      return "unknown";
  }
}

const SEVERITY: Record<ErrorKind, ErrorSeverity> = {
  session_expired: "critical",
  account_pending: "info",
  access_denied: "critical",
  not_found: "critical",
  validation: "info",
  conflict: "info",
  payload_too_large: "info",
  unsupported_media: "info",
  rate_limited: "warning",
  timeout: "critical",
  service_unavailable: "critical",
  network: "critical",
  offline: "warning",
  unknown: "critical",
};

const RECOVERY: Record<ErrorKind, RecoveryAction> = {
  session_expired: { kind: "sign_in" },
  account_pending: { kind: "retry" },
  access_denied: { kind: "none" },
  not_found: { kind: "back" },
  validation: { kind: "none" },
  conflict: { kind: "none" },
  payload_too_large: { kind: "none" },
  unsupported_media: { kind: "none" },
  rate_limited: { kind: "retry" },
  timeout: { kind: "retry" },
  service_unavailable: { kind: "retry" },
  network: { kind: "retry" },
  offline: { kind: "none" },
  unknown: { kind: "retry" },
};

/** Transient conditions (429/502/503/504-shaped, or the client's own
 * network/timeout failures) — the other half of "retryable" is the
 * context saying the operation is safe to repeat. */
const TRANSIENT_KINDS = new Set<ErrorKind>([
  "timeout",
  "service_unavailable",
  "network",
  "rate_limited",
]);

function isIdempotent(context: ErrorContext): boolean {
  return context.idempotent ?? context.operation === "load";
}

function build(
  kind: ErrorKind,
  code: ProblemCode,
  context: ErrorContext,
  problem?: ApiProblem,
): NormalizedAppError {
  const retryable = TRANSIENT_KINDS.has(kind) && isIdempotent(context);

  return {
    kind,
    severity: SEVERITY[kind],
    scope: context.scope,
    code,
    status: problem?.status,
    retryable,
    retryAfter: problem?.retryAfter,
    correlationId: problem?.correlationId,
    fieldErrors: problem?.fieldErrors,
    copy: resolveCopy(code, kind, context),
    recovery: RECOVERY[kind],
    problem,
  };
}

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * The single entry that turns any thrown failure into a `NormalizedAppError`
 * (ADR-0014 §4). Nothing downstream reads `status`, compares backend text,
 * or reaches into `ApiError` directly again — everything branches on
 * `.kind`.
 */
export function normalizeError(
  error: unknown,
  context: ErrorContext,
): NormalizedAppError {
  if (error instanceof ApiAbortError) {
    return {
      ...build("unknown", "unknown", context),
      cancelled: true,
    };
  }

  if (error instanceof ApiTimeoutError) {
    return build("timeout", "unknown", context);
  }

  if (error instanceof ApiNetworkError) {
    return build(
      isBrowserOffline() ? "offline" : "network",
      "unknown",
      context,
    );
  }

  if (error instanceof ApiProblemError) {
    const { problem } = error;
    return build(classify(problem), problem.code, context, problem);
  }

  // A plain `ApiError` (not `ApiProblemError`): `apiFetch` itself always
  // throws the richer subclass, but a caller can still construct the base
  // class directly (as pre-ADR-0014 tests already do) — synthesize the
  // same `ApiProblem` `parseProblem` would have produced from the wire.
  if (error instanceof ApiError) {
    const problem = parseProblem(
      { code: error.code, message: error.message },
      error.status,
      null,
    );
    return build(classify(problem), problem.code, context, problem);
  }

  return build("unknown", "unknown", context);
}
