import type { ApiErrorBody } from "@/shared/api/types";

/**
 * The web's own name for the API's `Error` schema (ADR-0014, docs/api.md):
 * the single Problem Details (RFC 9457) envelope every API error uses.
 *
 * `ProblemCode` is derived from the generated contract type, never
 * hand-written: a code the contract does not know about becomes `"unknown"`
 * at parse time (see `parseProblem`), and `shared/errors/messages.ts`'s
 * `Record<ProblemCode, …>` fails to typecheck if a new contract code has no
 * copy yet.
 */
export type ProblemCode = ApiErrorBody["code"] | "unknown";

export interface ApiProblem {
  code: ProblemCode;
  /** Backend prose (Spanish). Logging/support only — never shown to a user
   * as-is; `normalizeError` resolves display copy from `messages.ts` by
   * `code`. */
  title: string;
  detail?: string;
  status: number;
  correlationId?: string;
  retryable: boolean;
  retryAfter?: number;
  fieldErrors?: { field: string; code: string }[];
}

/**
 * Every code the contract's `Error.code` enum declares, mapped to `true`.
 * `satisfies Record<…, true>` makes this exhaustive both ways: adding a code
 * to the contract without adding it here fails the typecheck (a missing
 * required property), and a typo or a retired code fails it too (an unknown
 * property). This is the one place that enumerates the codes as literals —
 * everywhere else reads `ProblemCode` or this set.
 */
const KNOWN_CODES = {
  missing_token: true,
  invalid_token: true,
  unauthorized: true,
  unknown_identity: true,
  invalid_payload: true,
  not_found: true,
  internal_error: true,
  invalid_limit: true,
  invalid_cursor: true,
  no_profile_changes: true,
  name_too_long: true,
  username_invalid_length: true,
  username_numeric_only: true,
  username_taken: true,
  avatar_too_large: true,
  avatar_unsupported_type: true,
  invalid_email: true,
  invitation_already_sent: true,
  already_member: true,
  method_not_allowed: true,
  payload_too_large: true,
  request_timeout: true,
  upstream_unavailable: true,
} satisfies Record<Exclude<ProblemCode, "unknown">, true>;

function isKnownCode(value: unknown): value is Exclude<ProblemCode, "unknown"> {
  return typeof value === "string" && value in KNOWN_CODES;
}

function asRecord(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};
}

/** Case-insensitive by construction: `Headers.get` already is. */
function resolveHeaderCorrelationId(
  headers: HeadersInit | Headers | null | undefined,
): string | undefined {
  if (!headers) {
    return undefined;
  }
  const value = new Headers(headers).get("x-request-id");
  return value ?? undefined;
}

function parseFieldErrors(
  value: unknown,
): { field: string; code: string }[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries = value.filter(
    (entry): entry is { field: string; code: string } =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).field === "string" &&
      typeof (entry as Record<string, unknown>).code === "string",
  );
  return entries.length > 0 ? entries : undefined;
}

/**
 * The one place that turns an HTTP response body into an `ApiProblem`.
 * Accepts the current Problem Details envelope and, for compatibility, the
 * legacy pre-ADR-0014 `{code, message}` shape — a body with no `title` or
 * `detail` still parses, falling back to `message` for `detail`.
 *
 * The correlation id comes from the body's `correlation_id` when present,
 * otherwise from the `X-Request-ID` response header (every response carries
 * one, success or error — docs/api.md).
 */
export function parseProblem(
  body: unknown,
  status: number,
  headers?: HeadersInit | Headers | null,
): ApiProblem {
  const record = asRecord(body);
  const code: ProblemCode = isKnownCode(record.code) ? record.code : "unknown";
  const title = typeof record.title === "string" ? record.title : "";
  const detail =
    typeof record.detail === "string"
      ? record.detail
      : typeof record.message === "string"
        ? record.message
        : undefined;

  return {
    code,
    title,
    detail,
    status,
    correlationId:
      typeof record.correlation_id === "string"
        ? record.correlation_id
        : resolveHeaderCorrelationId(headers),
    retryable: record.retryable === true,
    retryAfter:
      typeof record.retry_after === "number" ? record.retry_after : undefined,
    fieldErrors: parseFieldErrors(record.field_errors),
  };
}
