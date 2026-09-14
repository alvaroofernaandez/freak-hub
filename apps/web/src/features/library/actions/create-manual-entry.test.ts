import { beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => Promise.resolve({ getToken }),
}));

/** The real `redirect()` throws, which is how it stops a server action. A
 * plain `vi.fn()` would return and let the action run past it. */
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT;${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

const apiFetch = vi.fn();
vi.mock("@/shared/lib/api-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/lib/api-client")
  >("@/shared/lib/api-client");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const { createManualEntry } = await import("./create-manual-entry");
const { MUTATION_TIMEOUT_MS } = await import("@/shared/lib/api-client");

const IDLE = { status: "idle" as const, message: "" };

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields = {
    category: "anime",
    title: "Fullmetal Alchemist: Brotherhood",
    year: "2009",
    synopsis: "Dos hermanos buscan la piedra filosofal.",
    status: "completed",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

function bothCallsSucceed() {
  apiFetch
    .mockResolvedValueOnce({ id: "work-fma" })
    .mockResolvedValueOnce({ id: "entry-fma" });
}

async function submit(data: FormData) {
  return createManualEntry(IDLE, data).catch(
    (cause: unknown) => cause as Error,
  );
}

describe("createManualEntry", () => {
  beforeEach(() => {
    getToken.mockResolvedValue("session-token");
  });

  it("creates the work first, then adds it to the library with the id the API returned", async () => {
    bothCallsSucceed();

    await submit(form());

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      "/v1/works",
      expect.objectContaining({
        method: "POST",
        token: "session-token",
        timeoutMs: MUTATION_TIMEOUT_MS,
        body: JSON.stringify({
          title: "Fullmetal Alchemist: Brotherhood",
          category: "anime",
          synopsis: "Dos hermanos buscan la piedra filosofal.",
          year: 2009,
        }),
      }),
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      "/v1/library",
      expect.objectContaining({
        method: "POST",
        token: "session-token",
        timeoutMs: MUTATION_TIMEOUT_MS,
        body: JSON.stringify({ work_id: "work-fma", status: "completed" }),
      }),
    );
  });

  it("sends the entry's own page as the destination, not the work's id", async () => {
    bothCallsSucceed();

    await submit(form());

    expect(redirect).toHaveBeenCalledWith("/obras/entry-fma");
  });

  it("sends an absent year and an absent synopsis as null, never as an empty string", async () => {
    bothCallsSucceed();

    await submit(form({ year: "", synopsis: "   " }));

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      "/v1/works",
      expect.objectContaining({
        body: JSON.stringify({
          title: "Fullmetal Alchemist: Brotherhood",
          category: "anime",
          synopsis: null,
          year: null,
        }),
      }),
    );
  });

  it.each([
    ["an empty title", { title: "   " }, "title"],
    ["a title over the contract's 300", { title: "a".repeat(301) }, "title"],
    [
      "a synopsis over the contract's 5000",
      { synopsis: "a".repeat(5001) },
      "synopsis",
    ],
    ["a year before 1800", { year: "1799" }, "year"],
    ["a year after 2200", { year: "2201" }, "year"],
    ["a year that is not a number", { year: "ayer" }, "year"],
  ])("refuses %s without touching the network, tying it to its own field", async (_case, overrides, field) => {
    const result = (await submit(form(overrides))) as Awaited<
      ReturnType<typeof createManualEntry>
    >;

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    expect(result.fieldErrors).toEqual([
      { field, message: expect.any(String) },
    ]);
  });

  it("accepts all six statuses, because creating an entry is not a transition", async () => {
    for (const status of [
      "wishlist",
      "pending",
      "in_progress",
      "completed",
      "dropped",
      "on_hold",
    ]) {
      apiFetch.mockReset();
      bothCallsSucceed();

      await submit(form({ status }));

      expect(apiFetch).toHaveBeenNthCalledWith(
        2,
        "/v1/library",
        expect.objectContaining({
          body: JSON.stringify({ work_id: "work-fma", status }),
        }),
      );
    }
  });

  it("refuses a status the contract does not declare", async () => {
    const result = (await submit(form({ status: "watching" }))) as Awaited<
      ReturnType<typeof createManualEntry>
    >;

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
  });

  it("asks for a status rather than guessing one, and ties the ask to the status field", async () => {
    const result = (await submit(form({ status: "" }))) as Awaited<
      ReturnType<typeof createManualEntry>
    >;

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.fieldErrors).toEqual([
      { field: "status", message: expect.stringMatching(/punto/i) },
    ]);
  });

  it("names the failed operation when creating the work fails, never the backend's own text", async () => {
    const { ApiProblemError } = await import("@/shared/lib/api-client");
    const { parseProblem } = await import("@/shared/errors/problem");
    const body = { code: "internal_error", message: "pq: connection refused" };
    apiFetch.mockRejectedValueOnce(
      new ApiProblemError(
        body.message,
        500,
        body.code,
        parseProblem(body, 500, null),
      ),
    );

    const result = (await submit(form())) as Awaited<
      ReturnType<typeof createManualEntry>
    >;

    expect(result.status).toBe("error");
    expect(result.message).toContain("crear la obra");
    expect(result.message).not.toContain("pq:");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses a NUL character before the network, which the API rejects outright", async () => {
    const withNul = (await submit(form({ title: "Frieren\u0000" }))) as Awaited<
      ReturnType<typeof createManualEntry>
    >;

    expect(apiFetch).not.toHaveBeenCalled();
    expect(withNul.status).toBe("error");
  });

  it("says the work was already created when only the library step failed, so nobody creates it twice", async () => {
    const { ApiProblemError } = await import("@/shared/lib/api-client");
    const { parseProblem } = await import("@/shared/errors/problem");
    const body = { code: "internal_error", message: "boom" };
    apiFetch
      .mockResolvedValueOnce({ id: "work-fma" })
      .mockRejectedValueOnce(
        new ApiProblemError(
          body.message,
          500,
          body.code,
          parseProblem(body, 500, null),
        ),
      );

    const result = (await submit(form())) as Awaited<
      ReturnType<typeof createManualEntry>
    >;

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/sí se ha creado en el catálogo/i);
    expect(redirect).not.toHaveBeenCalled();
    // The form reads this to keep its own submit button down: a second
    // submission is a second work, and works are never deleted.
    expect(result.workCreated).toBe(true);
  });

  /**
   * The message used to send people to «Añadir» to find the orphaned work
   * and add it from there. No such flow exists: `/anadir/[categoria]`
   * searches AniList only, `GET /v1/works` is consumed nowhere in the web,
   * and `catalog-search-results.tsx` deliberately has no add button. Naming
   * a remedy that does not exist is worse than naming none, because the only
   * thing the person can actually do is the one thing the message forbids.
   */
  it("does not send anybody down a route that does not exist to recover the orphaned work", async () => {
    const { ApiProblemError } = await import("@/shared/lib/api-client");
    const { parseProblem } = await import("@/shared/errors/problem");
    const body = { code: "internal_error", message: "boom" };
    apiFetch
      .mockResolvedValueOnce({ id: "work-fma" })
      .mockRejectedValueOnce(
        new ApiProblemError(
          body.message,
          500,
          body.code,
          parseProblem(body, 500, null),
        ),
      );

    const result = (await submit(form())) as Awaited<
      ReturnType<typeof createManualEntry>
    >;

    expect(result.message).not.toMatch(/añádela|búscala|desde ahí/i);
    expect(result.message).toMatch(/no vuelvas a enviar/i);
  });

  it("tells the member to sign in again when the session expired, instead of a generic retry", async () => {
    const { ApiProblemError } = await import("@/shared/lib/api-client");
    const { parseProblem } = await import("@/shared/errors/problem");
    const body = { code: "missing_token", message: "Falta el token." };
    apiFetch.mockRejectedValueOnce(
      new ApiProblemError(
        body.message,
        401,
        body.code,
        parseProblem(body, 401, null),
      ),
    );

    const result = (await submit(form())) as Awaited<
      ReturnType<typeof createManualEntry>
    >;

    expect(result.message).toBe("Inicia sesión de nuevo para continuar.");
  });

  it("does not prompt a blind retry when the create timed out, since the work may exist already", async () => {
    const { ApiTimeoutError } = await import("@/shared/lib/api-client");
    apiFetch.mockRejectedValueOnce(new ApiTimeoutError());

    const result = (await submit(form())) as Awaited<
      ReturnType<typeof createManualEntry>
    >;

    expect(result.status).toBe("error");
    expect(result.message).not.toMatch(/inténtalo de nuevo/i);
  });
});
