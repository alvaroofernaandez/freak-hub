import { beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => Promise.resolve({ getToken }),
}));

const apiFetch = vi.fn();
vi.mock("@/shared/lib/api-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/lib/api-client")
  >("@/shared/lib/api-client");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const { removeLibraryEntry } = await import("./remove-entry");
const { MUTATION_TIMEOUT_MS } = await import("@/shared/lib/api-client");

const ID = "6f2b2f5a-2f3a-4a91-8f2a-1c1c1c1c1c1c";
const IDLE = { status: "idle" as const, message: "" };

describe("removeLibraryEntry", () => {
  beforeEach(() => {
    getToken.mockResolvedValue("session-token");
    // 204 No Content: `apiFetch` answers null, and null is the success here.
    apiFetch.mockResolvedValue(null);
  });

  it("deletes the entry by its own id, with the mutation timeout", async () => {
    await removeLibraryEntry(IDLE, ID);

    expect(apiFetch).toHaveBeenCalledWith(
      `/v1/library/${ID}`,
      expect.objectContaining({
        method: "DELETE",
        token: "session-token",
        timeoutMs: MUTATION_TIMEOUT_MS,
      }),
    );
  });

  it("reads the contract's 204 as success rather than as an empty answer", async () => {
    const result = await removeLibraryEntry(IDLE, ID);

    expect(result.status).toBe("success");
  });

  it("refuses an id that is not an entry id, without touching the network", async () => {
    const result = await removeLibraryEntry(IDLE, "not-an-id");

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
  });

  it("says the entry is already gone when the API answers 404, in the product's own words", async () => {
    const { ApiProblemError } = await import("@/shared/lib/api-client");
    const { parseProblem } = await import("@/shared/errors/problem");
    const body = { code: "library_entry_not_found", message: "not found" };
    apiFetch.mockRejectedValue(
      new ApiProblemError(
        body.message,
        404,
        body.code,
        parseProblem(body, 404, null),
      ),
    );

    const result = await removeLibraryEntry(IDLE, ID);

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/ya no está en tu biblioteca/i);
  });

  it("does not invite a blind retry on a timeout: repeating a delete is a 404, not a no-op", async () => {
    const { ApiTimeoutError } = await import("@/shared/lib/api-client");
    apiFetch.mockRejectedValue(new ApiTimeoutError());

    const result = await removeLibraryEntry(IDLE, ID);

    expect(result.status).toBe("error");
    expect(result.message).not.toMatch(/inténtalo de nuevo/i);
  });

  it("names the failed operation on a server error, never the backend's own text", async () => {
    const { ApiProblemError } = await import("@/shared/lib/api-client");
    const { parseProblem } = await import("@/shared/errors/problem");
    const body = { code: "internal_error", message: "pq: connection refused" };
    apiFetch.mockRejectedValue(
      new ApiProblemError(
        body.message,
        500,
        body.code,
        parseProblem(body, 500, null),
      ),
    );

    const result = await removeLibraryEntry(IDLE, ID);

    expect(result.message).toContain("quitar la entrada");
    expect(result.message).not.toContain("pq:");
  });
});
