import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiAbortError,
  ApiError,
  ApiNetworkError,
  ApiProblemError,
  ApiTimeoutError,
  apiFetch,
  MUTATION_TIMEOUT_MS,
} from "./api-client";

const BASE_URL = "http://api.test";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("apiFetch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", BASE_URL);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("resolves the path against the configured API base URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/me");

    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/me`, expect.anything());
  });

  it("sends the Clerk token as a Bearer authorization header", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/me", { token: "jwt-123" });

    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get("authorization")).toBe("Bearer jwt-123");
  });

  it("omits the authorization header when there is no token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/health");

    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.has("authorization")).toBe(false);
  });

  it("returns the parsed JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ username: "alvaro" }));

    await expect(apiFetch<{ username: string }>("/me")).resolves.toEqual({
      username: "alvaro",
    });
  });

  it("returns null for a 204 No Content response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiFetch("/invitations/abc")).resolves.toBeNull();
  });

  it("throws an ApiError carrying the status and the API error code", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "invitation_not_found", message: "no existe" }, 404),
    );

    const error = await apiFetch("/invitations/abc").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "invitation_not_found" });
  });

  it("throws an ApiError when the API base URL is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
  });

  it("throws an ApiProblemError carrying the parsed Problem, including the correlation id", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "invitation_already_sent",
          message: "Ya hay una invitación pendiente para ese correo.",
          correlation_id: "abc123",
          retryable: false,
        }),
        {
          status: 409,
          headers: {
            "content-type": "application/problem+json",
            "x-request-id": "abc123",
          },
        },
      ),
    );

    const error = await apiFetch("/invitations").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(ApiProblemError);
    const problemError = error as ApiProblemError;
    expect(problemError.status).toBe(409);
    expect(problemError.code).toBe("invitation_already_sent");
    expect(problemError.problem.code).toBe("invitation_already_sent");
    expect(problemError.problem.correlationId).toBe("abc123");
  });

  it("throws an ApiNetworkError when fetch itself fails (no response at all)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiNetworkError);
  });

  it("throws an ApiTimeoutError when the request exceeds the configured timeout", async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("This operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    await expect(apiFetch("/me", { timeoutMs: 5 })).rejects.toBeInstanceOf(
      ApiTimeoutError,
    );
  });

  it("throws an ApiAbortError, distinct from a timeout, when the caller's own signal is aborted", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("This operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    const promise = apiFetch("/me", { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(ApiAbortError);
  });

  it("exposes a longer timeout for mutations and uploads than the read default", () => {
    // The API's own Timeout middleware allows up to 30s for a mutation; a
    // caller that passes MUTATION_TIMEOUT_MS should never time out before
    // the server itself would (docs/states.md).
    expect(MUTATION_TIMEOUT_MS).toBe(35_000);
    expect(MUTATION_TIMEOUT_MS).toBeGreaterThan(10_000);
  });
});
