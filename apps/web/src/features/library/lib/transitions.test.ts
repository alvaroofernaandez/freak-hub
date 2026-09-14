import { describe, expect, it } from "vitest";
import type { LibraryEntryStatus } from "@/shared/api/types";
import { allowedTransitions, canRate, canTransition } from "./transitions";

const EVERY_STATUS: LibraryEntryStatus[] = [
  "wishlist",
  "pending",
  "in_progress",
  "completed",
  "dropped",
  "on_hold",
];

describe("allowedTransitions", () => {
  it.each([
    ["wishlist", ["pending"]],
    ["pending", ["in_progress"]],
    ["in_progress", ["on_hold", "completed", "dropped"]],
    ["on_hold", ["in_progress"]],
    ["completed", ["in_progress"]],
    ["dropped", []],
  ] as [
    LibraryEntryStatus,
    LibraryEntryStatus[],
  ][])("draws the same arrows out of %s as docs/domain.md", (from, expected) => {
    expect(allowedTransitions(from)).toEqual(expected);
  });

  it("leaves the current status out, since staying put is not a move to offer", () => {
    for (const status of EVERY_STATUS) {
      expect(allowedTransitions(status)).not.toContain(status);
    }
  });

  it("makes dropped a dead end, so the interface offers no move at all from it", () => {
    expect(allowedTransitions("dropped")).toEqual([]);
  });
});

describe("canTransition", () => {
  it("accepts every arrow the diagram draws", () => {
    for (const from of EVERY_STATUS) {
      for (const to of allowedTransitions(from)) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  it("accepts staying put: re-sending the current status is a no-op, not an illegal move", () => {
    for (const status of EVERY_STATUS) {
      expect(canTransition(status, status)).toBe(true);
    }
  });

  it.each([
    ["wishlist", "completed"],
    ["pending", "on_hold"],
    ["completed", "dropped"],
    ["dropped", "in_progress"],
    ["on_hold", "completed"],
  ] as [
    LibraryEntryStatus,
    LibraryEntryStatus,
  ][])("refuses %s to %s, which the API would answer with invalid_transition", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe("canRate", () => {
  it("allows a score once there is an opinion: finished or abandoned", () => {
    expect(canRate("completed")).toBe(true);
    expect(canRate("dropped")).toBe(true);
  });

  it.each([
    "wishlist",
    "pending",
    "in_progress",
    "on_hold",
  ] as const)("refuses a score on %s, which the API answers with rating_not_allowed", (status) => {
    expect(canRate(status)).toBe(false);
  });
});
