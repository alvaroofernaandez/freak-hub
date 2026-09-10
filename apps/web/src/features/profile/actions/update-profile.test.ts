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

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: () => revalidatePath() }));

const { updateProfile } = await import("./update-profile");
const { ApiError, ApiProblemError, MUTATION_TIMEOUT_MS } = await import(
  "@/shared/lib/api-client"
);
const { parseProblem } = await import("@/shared/errors/problem");

function problemError(
  status: number,
  code: string,
  field?: string,
): InstanceType<typeof ApiProblemError> {
  const problem = parseProblem(
    {
      code,
      message: "detalle",
      field_errors: field ? [{ field, code }] : undefined,
    },
    status,
    null,
  );
  return new ApiProblemError("detalle", status, code, problem);
}

const IDLE = { status: "idle" as const, message: "" };

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

describe("updateProfile", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    getToken.mockReset();
    getToken.mockResolvedValue("session-token");
    revalidatePath.mockClear();
  });

  it("sends the edited fields to the API", async () => {
    apiFetch.mockResolvedValue({});

    const result = await updateProfile(
      IDLE,
      form({
        first_name: "Álvaro",
        last_name: "Fernández",
        username: "alvaro",
      }),
    );

    expect(apiFetch).toHaveBeenCalledWith(
      "/v1/me",
      expect.objectContaining({
        method: "PATCH",
        token: "session-token",
        body: JSON.stringify({
          first_name: "Álvaro",
          last_name: "Fernández",
          username: "alvaro",
        }),
        // A slow link shouldn't time out a save before the server's own
        // 30s ceiling would (docs/states.md).
        timeoutMs: MUTATION_TIMEOUT_MS,
      }),
    );
    expect(result.status).toBe("success");
  });

  it("rejects a username shorter than the instance allows, ties the error to the username field, without calling the API", async () => {
    const result = await updateProfile(IDLE, form({ username: "ab" }));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/3 y 24/);
    expect(result.fieldErrors).toEqual([
      { field: "username", message: expect.stringMatching(/3 y 24/) },
    ]);
  });

  it("says plainly when the username is taken, and ties it to the username field", async () => {
    apiFetch.mockRejectedValue(problemError(409, "username_taken", "username"));

    const result = await updateProfile(IDLE, form({ username: "alvaro" }));

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/ya está cogido/i);
    expect(result.fieldErrors).toEqual([
      { field: "username", message: expect.stringMatching(/ya está cogido/i) },
    ]);
  });

  it("still resolves a plain ApiError (no field_errors) to a form-level message", async () => {
    apiFetch.mockRejectedValue(new ApiError("taken", 409, "username_taken"));

    const result = await updateProfile(IDLE, form({ username: "alvaro" }));

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/ya está cogido/i);
  });

  it("reports a photo that is too heavy in its own words", async () => {
    apiFetch.mockRejectedValue(problemError(413, "avatar_too_large", "avatar"));

    const photo = new File(["x"], "foto.png", { type: "image/png" });
    const result = await updateProfile(IDLE, form({ avatar: photo }));

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/5 MB/);
    expect(result.fieldErrors).toEqual([
      { field: "avatar", message: expect.stringMatching(/5 MB/) },
    ]);
  });

  it("rejects an avatar heavier than the backend's own 5 MB limit, client-side, without uploading it", async () => {
    const heavy = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "foto.png", {
      type: "image/png",
    });

    const result = await updateProfile(IDLE, form({ avatar: heavy }));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    expect(result.fieldErrors).toEqual([
      { field: "avatar", message: expect.stringMatching(/5 MB/) },
    ]);
  });

  it("rejects an avatar of an unsupported type, client-side, without uploading it", async () => {
    const notAnImage = new File(["x"], "documento.pdf", {
      type: "application/pdf",
    });

    const result = await updateProfile(IDLE, form({ avatar: notAnImage }));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    expect(result.fieldErrors).toEqual([
      { field: "avatar", message: expect.stringMatching(/imagen/i) },
    ]);
  });

  it("uploads the photo separately, as multipart", async () => {
    apiFetch.mockResolvedValue({});
    const photo = new File(["x"], "foto.png", { type: "image/png" });

    await updateProfile(IDLE, form({ username: "alvaro", avatar: photo }));

    const paths = apiFetch.mock.calls.map((call) => call[0]);
    expect(paths).toContain("/v1/me/avatar");
    expect(paths).toContain("/v1/me");
  });

  it("gives the avatar upload a timeout above the server's own 30s ceiling", async () => {
    apiFetch.mockResolvedValue({});
    const photo = new File(["x"], "foto.png", { type: "image/png" });

    await updateProfile(IDLE, form({ avatar: photo }));

    const call = apiFetch.mock.calls.find((c) => c[0] === "/v1/me/avatar");
    expect(call?.[1]).toMatchObject({ timeoutMs: MUTATION_TIMEOUT_MS });
  });

  it("does not call the API at all when nothing was edited", async () => {
    const result = await updateProfile(IDLE, form({}));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
  });
});
