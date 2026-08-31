/**
 * Thin HTTP client for the Go API.
 *
 * The API is the only source of domain data; Next.js never talks to Postgres.
 * Authentication travels as a Clerk session JWT in the Authorization header,
 * which the API verifies against Clerk's JWKS.
 */

export interface ApiErrorPayload {
  code?: string;
  message?: string;
}

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

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  /** Clerk session token. Omit it for endpoints that are genuinely public. */
  token?: string | null;
  headers?: HeadersInit;
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

export async function apiFetch<T = unknown>(
  path: string,
  { token, headers, ...init }: ApiFetchOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("accept", "application/json");

  if (init.body !== undefined && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }

  if (token) {
    requestHeaders.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    ...init,
    headers: requestHeaders,
  });

  if (response.status === 204) {
    return null as T;
  }

  const payload = (await response.json().catch(() => null)) as
    | (ApiErrorPayload & Record<string, unknown>)
    | null;

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? `Request to ${path} failed`,
      response.status,
      payload?.code ?? "unknown_error",
    );
  }

  return payload as T;
}
