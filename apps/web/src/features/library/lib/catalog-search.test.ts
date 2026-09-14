import { describe, expect, it } from "vitest";
import type { CatalogSearchResult } from "./anilist";
import {
  catalogSearchAnnouncement,
  catalogSearchState,
} from "./catalog-search";

const RESULT: CatalogSearchResult = {
  id: "anilist:1535",
  title: "Death Note",
  year: 2006,
};

/** Anything that would tell a member which catalog we are calling, or how it
 * failed in HTTP terms. None of it belongs on a screen (docs/states.md). */
const LEAKS = /anilist|graphql|http|429|5\d\d|fetch|timeout|endpoint/i;

function copyOf(state: ReturnType<typeof catalogSearchState>): string {
  return state.kind === "error"
    ? `${state.error.copy.title} ${state.error.copy.description}`
    : "";
}

describe("catalogSearchState", () => {
  it("is idle before anything has been searched", () => {
    expect(catalogSearchState("", null)).toEqual({ kind: "idle" });
  });

  it("stays idle for a query that is only whitespace, without inventing a result", () => {
    expect(catalogSearchState("   ", null)).toEqual({ kind: "idle" });
  });

  it("hands over the results of a successful search", () => {
    expect(
      catalogSearchState("death note", {
        status: "ok",
        results: [RESULT],
      }),
    ).toEqual({ kind: "results", results: [RESULT] });
  });

  it("keeps the search term with an empty result, so the screen can quote it back", () => {
    expect(catalogSearchState("  zzzz  ", { status: "empty" })).toEqual({
      kind: "no_results",
      query: "zzzz",
    });
  });

  it("turns the rate limit into a retryable error that waits as long as the catalog asked", () => {
    const state = catalogSearchState("naruto", {
      status: "rate_limited",
      retryAfterSeconds: 30,
    });

    expect(state.kind).toBe("error");
    if (state.kind !== "error") return;
    expect(state.error.kind).toBe("rate_limited");
    expect(state.error.retryAfter).toBe(30);
    expect(state.error.recovery).toEqual({ kind: "retry" });
    expect(state.error.scope).toBe("section");
  });

  it("does not invent a wait when the catalog did not give one", () => {
    const state = catalogSearchState("naruto", { status: "rate_limited" });

    expect(state.kind).toBe("error");
    if (state.kind !== "error") return;
    expect(state.error.retryAfter).toBeUndefined();
  });

  it("turns an unreachable catalog into a service error, not into an empty result", () => {
    const state = catalogSearchState("naruto", { status: "unavailable" });

    expect(state.kind).toBe("error");
    if (state.kind !== "error") return;
    expect(state.error.kind).toBe("service_unavailable");
    expect(state.error.recovery).toEqual({ kind: "retry" });
  });

  it("points at the manual entry when the catalog is down, because that is the way out", () => {
    const state = catalogSearchState("naruto", { status: "unavailable" });

    expect(copyOf(state)).toMatch(/a mano/i);
  });

  it("never names the provider or its protocol in anything a member reads", () => {
    for (const outcome of [
      { status: "rate_limited" as const, retryAfterSeconds: 30 },
      { status: "unavailable" as const },
    ]) {
      expect(copyOf(catalogSearchState("naruto", outcome))).not.toMatch(LEAKS);
    }
  });

  it("writes its copy with tuteo, never voseo", () => {
    for (const outcome of [
      { status: "rate_limited" as const },
      { status: "unavailable" as const },
    ]) {
      expect(copyOf(catalogSearchState("naruto", outcome))).not.toMatch(
        /\b(pod[ée]s|ten[ée]s|volv[ée]|inténtalo vos|prob[áa] de nuevo vos)\b/i,
      );
    }
  });
});

describe("catalogSearchAnnouncement", () => {
  it("says nothing before a search has happened", () => {
    expect(catalogSearchAnnouncement({ kind: "idle" })).toBe("");
  });

  it("counts the results in the singular", () => {
    expect(
      catalogSearchAnnouncement({ kind: "results", results: [RESULT] }),
    ).toBe("1 resultado.");
  });

  it("counts the results in the plural", () => {
    expect(
      catalogSearchAnnouncement({
        kind: "results",
        results: [RESULT, { ...RESULT, id: "anilist:2" }],
      }),
    ).toBe("2 resultados.");
  });

  it("announces an empty search as such, not as silence", () => {
    expect(
      catalogSearchAnnouncement({ kind: "no_results", query: "zzzz" }),
    ).toBe("Sin resultados.");
  });

  it("leaves an error to its own live region instead of announcing it twice", () => {
    const state = catalogSearchState("naruto", { status: "unavailable" });
    expect(catalogSearchAnnouncement(state)).toBe("");
  });
});
