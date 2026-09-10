import { describe, expect, it } from "vitest";
import { type ApiProblem, type ProblemCode, parseProblem } from "./problem";

describe("parseProblem", () => {
  it("parses the full Problem Details envelope (ADR-0014)", () => {
    const problem = parseProblem(
      {
        type: "urn:freak-hub:problem:invitation_already_sent",
        title: "Invitación ya enviada",
        status: 409,
        detail: "Ya hay una invitación pendiente para ese correo.",
        instance: "/v1/invitations",
        code: "invitation_already_sent",
        message: "Ya hay una invitación pendiente para ese correo.",
        correlation_id: "4f0c2e9a7b1d3c5e8f6a0b2c4d6e8f10",
        retryable: false,
        field_errors: [{ field: "email", code: "invitation_already_sent" }],
      },
      409,
      null,
    );

    expect(problem).toMatchObject<Partial<ApiProblem>>({
      code: "invitation_already_sent",
      status: 409,
      correlationId: "4f0c2e9a7b1d3c5e8f6a0b2c4d6e8f10",
      retryable: false,
      fieldErrors: [{ field: "email", code: "invitation_already_sent" }],
    });
  });

  it("reads the correlation id from the X-Request-ID header when the body has none", () => {
    const problem = parseProblem(
      { code: "internal_error" },
      500,
      new Headers({ "X-Request-ID": "header-id-123" }),
    );

    expect(problem.correlationId).toBe("header-id-123");
  });

  it("prefers the body's correlation_id over the header when both are present", () => {
    const problem = parseProblem(
      { code: "internal_error", correlation_id: "body-id" },
      500,
      new Headers({ "X-Request-ID": "header-id" }),
    );

    expect(problem.correlationId).toBe("body-id");
  });

  it("has no correlation id when neither the body nor the header carries one", () => {
    const problem = parseProblem({ code: "internal_error" }, 500, null);

    expect(problem.correlationId).toBeUndefined();
  });

  it("maps a code the contract does not know to 'unknown'", () => {
    const problem = parseProblem(
      { code: "some_future_code_not_in_the_contract" },
      418,
      null,
    );

    const code: ProblemCode = problem.code;
    expect(code).toBe("unknown");
  });

  it("maps a missing or malformed body to 'unknown' without throwing", () => {
    expect(parseProblem(null, 500, null).code).toBe("unknown");
    expect(parseProblem(undefined, 500, null).code).toBe("unknown");
    expect(parseProblem("not an object", 500, null).code).toBe("unknown");
  });

  it("accepts the legacy {code, message} envelope predating ADR-0014", () => {
    // Compat shape: before ADR-0014 the API only ever sent `{code, message}`.
    const problem = parseProblem(
      { code: "username_taken", message: "Ese nombre ya está cogido." },
      409,
      null,
    );

    expect(problem.code).toBe("username_taken");
    expect(problem.status).toBe(409);
  });

  it("defaults retryable to false when the body omits it", () => {
    expect(parseProblem({ code: "not_found" }, 404, null).retryable).toBe(
      false,
    );
  });

  it("carries retry_after only when the body provides it", () => {
    const withDelay = parseProblem(
      { code: "upstream_unavailable", retryable: true, retry_after: 5 },
      503,
      null,
    );
    expect(withDelay.retryAfter).toBe(5);

    const withoutDelay = parseProblem(
      { code: "upstream_unavailable", retryable: true },
      503,
      null,
    );
    expect(withoutDelay.retryAfter).toBeUndefined();
  });
});
