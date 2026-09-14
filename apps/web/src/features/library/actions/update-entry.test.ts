import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryPatch } from "./update-entry";

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

const { updateLibraryEntry } = await import("./update-entry");
const { MUTATION_TIMEOUT_MS } = await import("@/shared/lib/api-client");

const ID = "6f2b2f5a-2f3a-4a91-8f2a-1c1c1c1c1c1c";
const IDLE = { status: "idle" as const, message: "" };

function update(patch: EntryPatch, id = ID) {
  return updateLibraryEntry(IDLE, { id, patch });
}

function sentBody(): unknown {
  const [, options] = apiFetch.mock.calls.at(-1) as [string, { body: string }];
  return JSON.parse(options.body);
}

describe("updateLibraryEntry", () => {
  beforeEach(() => {
    getToken.mockResolvedValue("session-token");
    apiFetch.mockResolvedValue({ id: ID });
  });

  it("patches the entry by its own id, with the mutation timeout", async () => {
    await update({ progress: 13 });

    expect(apiFetch).toHaveBeenCalledWith(
      `/v1/library/${ID}`,
      expect.objectContaining({
        method: "PATCH",
        token: "session-token",
        timeoutMs: MUTATION_TIMEOUT_MS,
      }),
    );
  });

  it("sends only the keys that changed, never the whole entry", async () => {
    await update({ progress: 13 });

    expect(sentBody()).toEqual({ progress: 13 });
  });

  it("never carries a rating alongside a status change, so the stored score survives", async () => {
    await update({ status: "in_progress" });

    const body = sentBody() as Record<string, unknown>;
    expect(body).toEqual({ status: "in_progress" });
    expect("rating" in body).toBe(false);
  });

  it("distinguishes clearing a rating from leaving it alone", async () => {
    await update({ rating: null });

    const body = sentBody() as Record<string, unknown>;
    expect("rating" in body).toBe(true);
    expect(body.rating).toBeNull();
  });

  it("keeps a false apart from an absent flag, since absent leaves the stored value alone", async () => {
    await update({ is_favourite: false, owned: false });

    expect(sentBody()).toEqual({ is_favourite: false, owned: false });
  });

  it("does not spend a round trip on a patch with nothing in it", async () => {
    const result = await update({});

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("idle");
  });

  it("sends a zero progress rather than dropping it as falsy", async () => {
    await update({ progress: 0 });

    expect(sentBody()).toEqual({ progress: 0 });
  });

  it.each([
    ["a negative progress", { progress: -1 }],
    ["a fractional progress", { progress: 2.5 }],
    ["a rating under the contract's 1", { rating: 0 }],
    ["a rating over the contract's 10", { rating: 11 }],
    ["a status the contract does not declare", { status: "watching" }],
  ])("refuses %s without touching the network", async (_case, patch) => {
    const result = await update(patch as EntryPatch);

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
  });

  it("refuses an id that is not an entry id", async () => {
    const result = await update({ progress: 1 }, "not-an-id");

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
  });

  it("reports the state machine's own refusal when the API rejects the transition", async () => {
    const { ApiProblemError } = await import("@/shared/lib/api-client");
    const { parseProblem } = await import("@/shared/errors/problem");
    const body = {
      code: "invalid_transition",
      message: "cannot go from wishlist to completed",
    };
    apiFetch.mockRejectedValue(
      new ApiProblemError(
        body.message,
        422,
        body.code,
        parseProblem(body, 422, null),
      ),
    );

    const result = await update({ status: "completed" });

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/no se puede pasar a ese estado/i);
    expect(result.message).not.toContain("cannot go from");
  });

  it("says the rating is not allowed yet in the product's own words", async () => {
    const { ApiProblemError } = await import("@/shared/lib/api-client");
    const { parseProblem } = await import("@/shared/errors/problem");
    const body = { code: "rating_not_allowed", message: "nope" };
    apiFetch.mockRejectedValue(
      new ApiProblemError(
        body.message,
        422,
        body.code,
        parseProblem(body, 422, null),
      ),
    );

    const result = await update({ rating: 8 });

    expect(result.message).toMatch(/terminado o lo que has abandonado/i);
  });

  it("does not prompt a blind retry when the save timed out", async () => {
    const { ApiTimeoutError } = await import("@/shared/lib/api-client");
    apiFetch.mockRejectedValue(new ApiTimeoutError());

    const result = await update({ progress: 13 });

    expect(result.status).toBe("error");
    expect(result.message).not.toMatch(/inténtalo de nuevo/i);
  });

  it("reports success once the API has answered, never before", async () => {
    const result = await update({ progress: 13 });

    expect(result.status).toBe("success");
    expect(apiFetch).toHaveBeenCalled();
  });
});
