import { describe, expect, it, vi } from "vitest";
import {
  ApiAbortError,
  ApiError,
  ApiNetworkError,
  ApiProblemError,
  ApiTimeoutError,
} from "@/shared/lib/api-client";
import { normalizeError } from "./normalize-error";
import { parseProblem } from "./problem";
import type { ErrorContext } from "./types";

const LOAD: ErrorContext = {
  resource: "el grupo",
  operation: "load",
  scope: "page",
};

const SUBMIT_NON_IDEMPOTENT: ErrorContext = {
  resource: "la invitación",
  operation: "submit",
  scope: "operation",
  idempotent: false,
};

function problemError(body: Record<string, unknown>, status: number) {
  const problem = parseProblem(body, status, null);
  return new ApiProblemError(
    typeof body.message === "string" ? body.message : "error",
    status,
    typeof body.code === "string" ? body.code : "unknown_error",
    problem,
  );
}

const SEND_INVITATION: ErrorContext = {
  ...SUBMIT_NON_IDEMPOTENT,
  action: "enviar la invitación",
};

const SAVE_PROFILE: ErrorContext = {
  resource: "tu perfil",
  operation: "submit",
  scope: "operation",
  idempotent: false,
};

describe("normalizeError copy for a submit", () => {
  it("keeps the profile's save copy when the context names no action", () => {
    const normalized = normalizeError(
      problemError({ code: "internal_error" }, 500),
      SAVE_PROFILE,
    );

    expect(normalized.copy.description).toBe(
      "No se han podido guardar los cambios. Inténtalo de nuevo.",
    );
  });

  it("names the operation that failed when the context gives one", () => {
    const normalized = normalizeError(
      problemError({ code: "internal_error" }, 500),
      SEND_INVITATION,
    );

    expect(normalized.copy.description).toBe(
      "No se ha podido enviar la invitación. Inténtalo de nuevo.",
    );
  });

  it.each([
    ["a client-side timeout", () => new ApiTimeoutError()],
    ["a server-side 504", () => problemError({ code: "request_timeout" }, 504)],
  ])("does not invite a blind retry after %s on a non-idempotent submit", (_label, makeError) => {
    const normalized = normalizeError(makeError(), SEND_INVITATION);

    // The outcome is unknown: the send may have gone through before the
    // deadline, so the copy asks to check first instead of "try again".
    expect(normalized.copy.description).toMatch(
      /^No sabemos si se ha podido enviar la invitación\./,
    );
    expect(normalized.copy.description).not.toMatch(/inténtalo de nuevo/i);
  });
});

describe("normalizeError", () => {
  it("classifies a missing/invalid token as a session_expired kind", () => {
    const normalized = normalizeError(
      problemError({ code: "invalid_token" }, 401),
      LOAD,
    );

    expect(normalized.kind).toBe("session_expired");
    expect(normalized.recovery).toEqual({ kind: "sign_in" });
  });

  it("classifies unknown_identity (404) as account_pending, not a generic not_found", () => {
    const normalized = normalizeError(
      problemError({ code: "unknown_identity" }, 404),
      LOAD,
    );

    expect(normalized.kind).toBe("account_pending");
  });

  it("classifies a plain 404 not_found as not_found", () => {
    const normalized = normalizeError(
      problemError({ code: "not_found" }, 404),
      LOAD,
    );

    expect(normalized.kind).toBe("not_found");
  });

  it("classifies a 403 as access_denied regardless of code", () => {
    const normalized = normalizeError(problemError({}, 403), LOAD);

    expect(normalized.kind).toBe("access_denied");
  });

  it("classifies a 422 as validation and keeps the field errors", () => {
    const normalized = normalizeError(
      problemError(
        {
          code: "invalid_email",
          field_errors: [{ field: "email", code: "invalid_email" }],
        },
        422,
      ),
      LOAD,
    );

    expect(normalized.kind).toBe("validation");
    expect(normalized.fieldErrors).toEqual([
      { field: "email", code: "invalid_email" },
    ]);
  });

  it("classifies a 409 as conflict", () => {
    const normalized = normalizeError(
      problemError({ code: "username_taken" }, 409),
      LOAD,
    );

    expect(normalized.kind).toBe("conflict");
  });

  it("classifies a 504 request_timeout as timeout, retryable for a load", () => {
    const normalized = normalizeError(
      problemError({ code: "request_timeout", retryable: true }, 504),
      LOAD,
    );

    expect(normalized.kind).toBe("timeout");
    expect(normalized.retryable).toBe(true);
    expect(normalized.recovery).toEqual({ kind: "retry" });
  });

  it("classifies a 503 upstream_unavailable as service_unavailable", () => {
    const normalized = normalizeError(
      problemError({ code: "upstream_unavailable", retryable: true }, 503),
      LOAD,
    );

    expect(normalized.kind).toBe("service_unavailable");
    expect(normalized.retryable).toBe(true);
  });

  it("classifies a 429 as rate_limited and carries retryAfter", () => {
    const normalized = normalizeError(
      problemError({ code: "unknown", retryable: true, retry_after: 30 }, 429),
      LOAD,
    );

    expect(normalized.kind).toBe("rate_limited");
    expect(normalized.retryAfter).toBe(30);
  });

  it("classifies a 413 as payload_too_large and a 415 as unsupported_media", () => {
    expect(
      normalizeError(problemError({ code: "payload_too_large" }, 413), LOAD)
        .kind,
    ).toBe("payload_too_large");
    expect(
      normalizeError(
        problemError({ code: "avatar_unsupported_type" }, 415),
        LOAD,
      ).kind,
    ).toBe("unsupported_media");
  });

  it("classifies an ApiTimeoutError (client-side) as timeout", () => {
    expect(normalizeError(new ApiTimeoutError(), LOAD).kind).toBe("timeout");
  });

  it("classifies an ApiNetworkError as network when the browser reports it is online", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(normalizeError(new ApiNetworkError(), LOAD).kind).toBe("network");
    vi.unstubAllGlobals();
  });

  it("classifies an ApiNetworkError as offline when the browser reports it is offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(normalizeError(new ApiNetworkError(), LOAD).kind).toBe("offline");
    vi.unstubAllGlobals();
  });

  it("marks an ApiAbortError as cancelled, never a reportable failure", () => {
    const normalized = normalizeError(new ApiAbortError(), LOAD);

    expect(normalized.cancelled).toBe(true);
  });

  it("classifies a plain ApiError (not ApiProblemError) the same way, for callers that construct it directly", () => {
    const normalized = normalizeError(
      new ApiError("taken", 409, "username_taken"),
      LOAD,
    );

    expect(normalized.kind).toBe("conflict");
    expect(normalized.copy.description).toMatch(/ya está cogido/i);
  });

  it("falls back to unknown for a plain JS exception", () => {
    expect(normalizeError(new Error("boom"), LOAD).kind).toBe("unknown");
  });

  it("never propagates the backend's own title/detail text as display copy", () => {
    const normalized = normalizeError(
      problemError(
        {
          code: "internal_error",
          title: "panic: nil pointer dereference at handlers.go:42",
          detail: "SELECT * FROM members WHERE id = $1 failed: pq: ...",
        },
        500,
      ),
      LOAD,
    );

    expect(normalized.copy.title).not.toMatch(/panic|pointer|handlers\.go/i);
    expect(normalized.copy.description).not.toMatch(/SELECT|pq:/i);
  });

  it("reads the correlation id through from the parsed problem", () => {
    const normalized = normalizeError(
      problemError({ code: "internal_error", correlation_id: "xyz" }, 500),
      LOAD,
    );

    expect(normalized.correlationId).toBe("xyz");
  });

  it("is retryable only when the failure is transient and the operation is idempotent", () => {
    // A load (GET) defaults to idempotent: true.
    const transientLoad = normalizeError(
      problemError({ code: "upstream_unavailable", retryable: true }, 503),
      LOAD,
    );
    expect(transientLoad.retryable).toBe(true);

    // A non-idempotent submit (e.g. sending an invitation) is never
    // retryable, even for a transient condition.
    const transientSubmit = normalizeError(
      problemError({ code: "upstream_unavailable", retryable: true }, 503),
      SUBMIT_NON_IDEMPOTENT,
    );
    expect(transientSubmit.retryable).toBe(false);

    // A non-transient failure is never retryable regardless of idempotency.
    const permanent = normalizeError(
      problemError({ code: "username_taken" }, 409),
      LOAD,
    );
    expect(permanent.retryable).toBe(false);
  });
});
