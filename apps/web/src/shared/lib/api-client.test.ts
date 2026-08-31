import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./api-client";

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
});
