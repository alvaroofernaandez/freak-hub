import { describe, expect, it } from "vitest";
import type { ViewState } from "./view-state";
import { isError, isReady } from "./view-state";

const READY: ViewState<{ id: string }> = { status: "ready", data: { id: "1" } };
const EMPTY: ViewState<{ id: string }> = { status: "empty" };
const ERROR: ViewState<{ id: string }> = {
  status: "error",
  error: {
    kind: "unknown",
    severity: "critical",
    scope: "page",
    code: "unknown",
    retryable: true,
    copy: { title: "t", description: "d" },
    recovery: { kind: "retry" },
  },
};

describe("ViewState guards", () => {
  it("narrows a ready state and exposes its data", () => {
    expect(isReady(READY)).toBe(true);
    if (isReady(READY)) {
      expect(READY.data.id).toBe("1");
    }
  });

  it("does not treat empty or error as ready", () => {
    expect(isReady(EMPTY)).toBe(false);
    expect(isReady(ERROR)).toBe(false);
  });

  it("narrows an error state and exposes the normalized error", () => {
    expect(isError(ERROR)).toBe(true);
    if (isError(ERROR)) {
      expect(ERROR.error.kind).toBe("unknown");
    }
  });
});
