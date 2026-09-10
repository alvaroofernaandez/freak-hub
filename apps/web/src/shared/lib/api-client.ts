/**
 * Thin HTTP client for the Go API.
 *
 * The API is the only source of domain data; Next.js never talks to Postgres.
 * Authentication travels as a Clerk session JWT in the Authorization header,
 * which the API verifies against Clerk's JWKS.
 */

import { type ApiProblem, parseProblem } from "@/shared/errors/problem";

export interface ApiErrorPayload {
  code?: string;
  message?: string;
}

/** Every request gets a hard ceiling so a hung upstream never leaves a page
 * loading forever (ADR-0014). Combined with any caller-supplied `signal`. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * For mutations and uploads (PATCH/POST/DELETE, and any `multipart/form-data`
 * body), pass this as `timeoutMs` instead of the read default. The API's own
 * `chi` Timeout middleware allows up to 30s for a write; a 5MB avatar on a
 * slow link can legitimately take longer than `DEFAULT_TIMEOUT_MS` without
 * the server itself ever being at fault. 35s stays above the server's own
 * ceiling so a real client-side hang still surfaces before the caller gives
 * up waiting (docs/states.md).
 */
export const MUTATION_TIMEOUT_MS = 35_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** An API error that carries the full parsed Problem Details envelope
 * (ADR-0014), for `normalizeError` to branch on. `.code`/`.status` (from
 * `ApiError`) stay the raw values straight off the wire, exactly as before —
 * `.problem.code` is the validated, contract-narrowed one. */
export class ApiProblemError extends ApiError {
  readonly problem: ApiProblem;

  constructor(
    message: string,
    status: number,
    code: string,
    problem: ApiProblem,
  ) {
    super(message, status, code);
    this.name = "ApiProblemError";
    this.problem = problem;
  }
}

/** `fetch` itself failed: no response was ever received (offline, DNS,
 * CORS, a dropped connection). Distinct from `ApiProblemError`, which means
 * the API answered with an error body. */
export class ApiNetworkError extends Error {
  constructor(cause?: unknown) {
    super("Network request failed");
    this.name = "ApiNetworkError";
    this.cause = cause;
  }
}

/** The request did not finish within `timeoutMs`. */
export class ApiTimeoutError extends Error {
  constructor() {
    super("Request timed out");
    this.name = "ApiTimeoutError";
  }
}

/** The *caller's own* `signal` was aborted (a navigation moving away, a
 * component unmounting mid-request). Not a failure to report or show — the
 * caller asked for this. */
export class ApiAbortError extends Error {
  constructor() {
    super("Request aborted");
    this.name = "ApiAbortError";
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  /** Clerk session token. Omit it for endpoints that are genuinely public. */
  token?: string | null;
  headers?: HeadersInit;
  /** Overrides `DEFAULT_TIMEOUT_MS`, mainly for tests. */
  timeoutMs?: number;
}

function resolveBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new ApiError(
      "NEXT_PUBLIC_API_URL is not configured",
      0,
      "api_url_not_configured",
    );
  }

  return baseUrl.replace(/\/$/, "");
}

function combineSignals(
  timeoutSignal: AbortSignal,
  callerSignal: AbortSignal | null | undefined,
): AbortSignal {
  if (!callerSignal) {
    return timeoutSignal;
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([timeoutSignal, callerSignal]);
  }
  // No AbortSignal.any: the timeout still applies, the caller signal does
  // not abort the fetch itself, only whichever effect started it.
  return timeoutSignal;
}

export async function apiFetch<T = unknown>(
  path: string,
  {
    token,
    headers,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal,
    ...init
  }: ApiFetchOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("accept", "application/json");

  if (init.body !== undefined && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }

  if (token) {
    requestHeaders.set("authorization", `Bearer ${token}`);
  }

  const baseUrl = resolveBaseUrl();
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = combineSignals(timeoutSignal, callerSignal);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: requestHeaders,
      signal,
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw timeoutSignal.aborted ? new ApiTimeoutError() : new ApiAbortError();
    }
    throw new ApiNetworkError(cause);
  }

  if (response.status === 204) {
    return null as T;
  }

  const payload = (await response.json().catch(() => null)) as
    | (ApiErrorPayload & Record<string, unknown>)
    | null;

  if (!response.ok) {
    const problem = parseProblem(payload, response.status, response.headers);
    throw new ApiProblemError(
      payload?.message ?? `Request to ${path} failed`,
      response.status,
      payload?.code ?? "unknown_error",
      problem,
    );
  }

  return payload as T;
}
