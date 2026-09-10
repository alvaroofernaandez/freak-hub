import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportError } from "./report-error";
import type { NormalizedAppError } from "./types";

function normalized(
  overrides: Partial<NormalizedAppError> = {},
): NormalizedAppError {
  return {
    kind: "unknown",
    severity: "critical",
    scope: "page",
    code: "internal_error",
    retryable: false,
    copy: { title: "t", description: "d" },
    recovery: { kind: "retry" },
    ...overrides,
  };
}

describe("reportError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("logs an unexpected kind with only safe fields", () => {
    reportError(
      normalized({
        kind: "service_unavailable",
        code: "upstream_unavailable",
        status: 503,
        correlationId: "corr-1",
      }),
      { route: "/miembros" },
    );

    expect(console.error).toHaveBeenCalledTimes(1);
    const [, payload] = vi.mocked(console.error).mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(payload).toEqual({
      kind: "service_unavailable",
      code: "upstream_unavailable",
      status: 503,
      scope: "page",
      route: "/miembros",
      correlationId: "corr-1",
    });
  });

  it.each([
    ["validation" as const],
    ["not_found" as const],
    ["account_pending" as const],
    ["access_denied" as const],
  ])("never logs an expected %s kind", (kind) => {
    reportError(normalized({ kind }));

    expect(console.error).not.toHaveBeenCalled();
  });

  it("never logs a cancelled (aborted) failure", () => {
    reportError(normalized({ cancelled: true }));

    expect(console.error).not.toHaveBeenCalled();
  });

  it("never logs anything outside development", () => {
    vi.stubEnv("NODE_ENV", "production");

    reportError(normalized({ kind: "unknown" }));

    expect(console.error).not.toHaveBeenCalled();
  });

  it("never leaks the copy or the raw problem into the logged payload", () => {
    reportError(
      normalized({
        kind: "unknown",
        copy: { title: "sensitive title", description: "sensitive detail" },
      }),
    );

    const [, payload] = vi.mocked(console.error).mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(JSON.stringify(payload)).not.toMatch(/sensitive/);
  });
});
