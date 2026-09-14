import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/shared/lib/api-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/lib/api-client")
  >("@/shared/lib/api-client");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const reportError = vi.fn();
vi.mock("@/shared/errors/report-error", () => ({
  reportError: (...args: unknown[]) => reportError(...args),
}));

const { loadResource } = await import("./load-resource");
const { ApiError } = await import("@/shared/lib/api-client");

describe("loadResource", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    reportError.mockReset();
  });

  it("passes the caller's token through to the request", async () => {
    apiFetch.mockResolvedValue({ items: [] });

    await loadResource("/v1/library?limit=100", {
      token: "session-token",
      resource: "tu biblioteca",
      route: "/biblioteca",
    });

    expect(apiFetch).toHaveBeenCalledWith("/v1/library?limit=100", {
      token: "session-token",
    });
  });

  it("hands back what the API answered", async () => {
    apiFetch.mockResolvedValue({ items: [{ id: "1" }], next_cursor: null });

    const result = await loadResource<{ items: { id: string }[] }>("/v1/x", {
      token: null,
      resource: "tu biblioteca",
      route: "/biblioteca",
    });

    expect(result).toEqual({
      status: "ready",
      data: { items: [{ id: "1" }], next_cursor: null },
    });
  });

  it("normalizes a failure instead of letting it escape as an ApiError", async () => {
    apiFetch.mockRejectedValue(
      new ApiError("boom", 503, "service_unavailable"),
    );

    const result = await loadResource("/v1/x", {
      token: null,
      resource: "tu biblioteca",
      route: "/biblioteca",
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.error.kind).toBe("service_unavailable");
    expect(result.error.scope).toBe("page");
    expect(result.error.retryable).toBe(true);
  });

  it("reads a 404 unknown_identity as an account still being prepared, not as a missing resource", async () => {
    apiFetch.mockRejectedValue(
      new ApiError("not ready", 404, "unknown_identity"),
    );

    const result = await loadResource("/v1/library", {
      token: null,
      resource: "tu biblioteca",
      route: "/biblioteca",
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.error.kind).toBe("account_pending");
  });

  it("narrows the failure to a section when the caller says so", async () => {
    apiFetch.mockRejectedValue(new ApiError("boom", 500, "internal_error"));

    const result = await loadResource("/v1/x", {
      token: null,
      resource: "tu biblioteca",
      route: "/inicio",
      scope: "section",
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.error.scope).toBe("section");
  });

  it("reports the failure with the route it happened on", async () => {
    apiFetch.mockRejectedValue(new ApiError("boom", 500, "internal_error"));

    await loadResource("/v1/x", {
      token: null,
      resource: "tu biblioteca",
      route: "/biblioteca",
    });

    expect(reportError).toHaveBeenCalledWith(expect.anything(), {
      route: "/biblioteca",
    });
  });
});
