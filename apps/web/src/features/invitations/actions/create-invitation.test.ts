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

const { createInvitation } = await import("./create-invitation");
const { MUTATION_TIMEOUT_MS } = await import("@/shared/lib/api-client");

const IDLE = { status: "idle" as const, message: "" };

function form(email: string): FormData {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("createInvitation", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    getToken.mockReset();
    getToken.mockResolvedValue("session-token");
  });

  it("sends the invitation", async () => {
    apiFetch.mockResolvedValue({});

    const result = await createInvitation(IDLE, form("nueva@example.com"));

    expect(apiFetch).toHaveBeenCalledWith(
      "/v1/invitations",
      expect.objectContaining({
        method: "POST",
        token: "session-token",
        body: JSON.stringify({ email: "nueva@example.com" }),
      }),
    );
    expect(result.status).toBe("success");
  });

  it("gives the send a timeout above the server's own 30s ceiling, same as any other mutation", async () => {
    apiFetch.mockResolvedValue({});

    await createInvitation(IDLE, form("nueva@example.com"));

    expect(apiFetch).toHaveBeenCalledWith(
      "/v1/invitations",
      expect.objectContaining({ timeoutMs: MUTATION_TIMEOUT_MS }),
    );
  });

  it("rejects an invalid email without calling the API, tying the error to the email field", async () => {
    const result = await createInvitation(IDLE, form("no-es-un-correo"));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    expect(result.fieldErrors).toEqual([
      { field: "email", message: expect.any(String) },
    ]);
  });

  it("ties a conflict from the API (already invited) to the email field", async () => {
    const { ApiProblemError } = await import("@/shared/lib/api-client");
    const { parseProblem } = await import("@/shared/errors/problem");
    const problem = parseProblem(
      {
        code: "invitation_already_sent",
        message: "Ya hay una invitación pendiente para ese correo.",
        field_errors: [{ field: "email", code: "invitation_already_sent" }],
      },
      409,
      null,
    );
    apiFetch.mockRejectedValue(
      new ApiProblemError(
        "Ya hay una invitación pendiente para ese correo.",
        409,
        "invitation_already_sent",
        problem,
      ),
    );

    const result = await createInvitation(IDLE, form("nueva@example.com"));

    expect(result.status).toBe("error");
    expect(result.fieldErrors).toEqual([
      {
        field: "email",
        message: expect.stringMatching(/invitación pendiente/i),
      },
    ]);
  });

  it("tells the member to sign in again when the session has expired, instead of a generic retry", async () => {
    const { ApiProblemError } = await import("@/shared/lib/api-client");
    const { parseProblem } = await import("@/shared/errors/problem");
    const body = {
      code: "missing_token",
      message: "Falta el token de sesión.",
    };
    apiFetch.mockRejectedValue(
      new ApiProblemError(
        body.message,
        401,
        body.code,
        parseProblem(body, 401, null),
      ),
    );

    const result = await createInvitation(IDLE, form("nueva@example.com"));

    expect(result.status).toBe("error");
    expect(result.message).toBe("Inicia sesión de nuevo para continuar.");
  });

  it("does not prompt a blind retry when the send timed out, since it may have gone out anyway", async () => {
    const { ApiTimeoutError } = await import("@/shared/lib/api-client");
    apiFetch.mockRejectedValue(new ApiTimeoutError());

    const result = await createInvitation(IDLE, form("nueva@example.com"));

    expect(result.status).toBe("error");
    expect(result.message).toMatch(
      /^No sabemos si se ha podido enviar la invitación\./,
    );
    expect(result.message).not.toMatch(/inténtalo de nuevo/i);
  });

  it("names the failed operation on a server error, never showing the backend's own text", async () => {
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

    const result = await createInvitation(IDLE, form("nueva@example.com"));

    expect(result.message).toBe(
      "No se ha podido enviar la invitación. Inténtalo de nuevo.",
    );
    expect(result.message).not.toContain("pq:");
  });
});
