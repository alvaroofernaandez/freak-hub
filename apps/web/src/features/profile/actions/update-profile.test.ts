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
const { ApiError } = await import("@/shared/lib/api-client");

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
      }),
    );
    expect(result.status).toBe("success");
  });

  it("rejects a username shorter than the instance allows, without calling the API", async () => {
    const result = await updateProfile(IDLE, form({ username: "ab" }));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/3 y 24/);
  });

  it("says plainly when the username is taken", async () => {
    apiFetch.mockRejectedValue(new ApiError("taken", 409, "username_taken"));

    const result = await updateProfile(IDLE, form({ username: "alvaro" }));

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/ya está cogido/i);
  });

  it("reports a photo that is too heavy in its own words", async () => {
    apiFetch.mockRejectedValue(
      new ApiError("too large", 413, "avatar_too_large"),
    );

    const photo = new File(["x"], "foto.png", { type: "image/png" });
    const result = await updateProfile(IDLE, form({ avatar: photo }));

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/5 MB/);
  });

  it("uploads the photo separately, as multipart", async () => {
    apiFetch.mockResolvedValue({});
    const photo = new File(["x"], "foto.png", { type: "image/png" });

    await updateProfile(IDLE, form({ username: "alvaro", avatar: photo }));

    const paths = apiFetch.mock.calls.map((call) => call[0]);
    expect(paths).toContain("/v1/me/avatar");
    expect(paths).toContain("/v1/me");
  });

  it("does not call the API at all when nothing was edited", async () => {
    const result = await updateProfile(IDLE, form({}));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
  });
});
