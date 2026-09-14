import { describe, expect, it } from "vitest";
import {
  buildPatch,
  type ParsedDraft,
  readProgress,
  readRating,
} from "./entry-draft";
import type { LibraryItem } from "./library-item";

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "entry-fma",
    workId: "work-fma",
    title: "Fullmetal Alchemist: Brotherhood",
    category: "anime",
    status: "in_progress",
    progress: 12,
    progressTotal: 64,
    rating: null,
    isFavourite: false,
    owned: false,
    note: null,
    year: 2009,
    season: null,
    source: "anilist",
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function draft(overrides: Partial<ParsedDraft> = {}): ParsedDraft {
  return {
    status: "in_progress",
    progress: 12,
    rating: null,
    isFavourite: false,
    owned: false,
    ...overrides,
  };
}

describe("readProgress", () => {
  it("reads a plain count", () => {
    expect(readProgress("13", 64)).toEqual({ kind: "value", value: 13 });
  });

  it("reads zero, which is a real value and not an absence", () => {
    expect(readProgress("0", 64)).toEqual({ kind: "value", value: 0 });
  });

  /**
   * The bug this file exists for. `<input type="number">` sanitizes: the box
   * shows `12e` while `.value` reads `""`, which the old editor collapsed to
   * `0` and sent as a deliberate write. These fields are plain text now, so
   * the unreadable input is visible here and refused instead of coerced.
   */
  it.each([
    "12e",
    "2.5",
    "-1",
    "1 2",
    "٣",
    "",
    "   ",
  ])("refuses %o rather than quietly turning it into a number", (text) => {
    expect(readProgress(text, 64).kind).toBe("invalid");
  });

  it("refuses a count past a total the catalogue did declare", () => {
    const result = readProgress("9999", 12);

    expect(result.kind).toBe("invalid");
    expect(result).toMatchObject({ message: expect.stringContaining("12") });
  });

  it("accepts any count when the catalogue declared no total, per domain rule 5", () => {
    expect(readProgress("9999", null)).toEqual({ kind: "value", value: 9999 });
  });

  it("accepts exactly the total, which is the last episode and not one past it", () => {
    expect(readProgress("64", 64)).toEqual({ kind: "value", value: 64 });
  });
});

describe("readRating", () => {
  it("reads a score", () => {
    expect(readRating("8")).toEqual({ kind: "value", value: 8 });
  });

  it("reads an empty box as no score", () => {
    expect(readRating("")).toEqual({ kind: "value", value: null });
  });

  it.each([
    "8e",
    "7.5",
    "0",
    "11",
    "-3",
    "ocho",
  ])("refuses %o rather than quietly clearing the score", (text) => {
    expect(readRating(text).kind).toBe("invalid");
  });
});

describe("buildPatch", () => {
  it("sends nothing when nothing moved", () => {
    expect(buildPatch(item(), draft())).toEqual({});
  });

  it("sends only what moved", () => {
    expect(buildPatch(item(), draft({ progress: 13 }))).toEqual({
      progress: 13,
    });
  });

  it("keeps a zero and a false, which are values and not absences", () => {
    expect(
      buildPatch(
        item({ progress: 12, owned: true }),
        draft({ progress: 0, owned: false }),
      ),
    ).toEqual({ progress: 0, owned: false });
  });

  it("never carries a rating alongside a status change, so a rewatch keeps its score", () => {
    expect(
      buildPatch(
        item({ status: "completed", rating: 8 }),
        draft({ status: "in_progress", rating: 8 }),
      ),
    ).toEqual({ status: "in_progress" });
  });

  /**
   * The API checks an incoming rating against the status the entry ends up
   * in, and does it in the same atomic request as the transition. A score
   * typed on a `completed` entry that is then moved to `in_progress` would
   * come back `422 rating_not_allowed` and take the status change down with
   * it, leaving the person stuck behind two disabled controls.
   */
  it("drops a changed score the resulting status cannot carry, instead of losing the transition with it", () => {
    expect(
      buildPatch(
        item({ status: "completed", rating: null }),
        draft({ status: "in_progress", rating: 8 }),
      ),
    ).toEqual({ status: "in_progress" });
  });

  it("still sends an explicit null in a status that cannot be rated, because clearing is always allowed", () => {
    expect(
      buildPatch(
        item({ status: "completed", rating: 8 }),
        draft({ status: "in_progress", rating: null }),
      ),
    ).toEqual({ status: "in_progress", rating: null });
  });

  it.each([
    "completed",
    "dropped",
  ] as const)("sends a score when the entry ends up %s", (status) => {
    expect(
      buildPatch(
        item({ status: "completed", rating: null }),
        draft({ status, rating: 8 }),
      ),
    ).toMatchObject({ rating: 8 });
  });

  it("sends a score with no status change when the entry already sits where rating is allowed", () => {
    expect(
      buildPatch(
        item({ status: "dropped", rating: 4 }),
        draft({ status: "dropped", rating: 9 }),
      ),
    ).toEqual({ rating: 9 });
  });
});
