import { describe, expect, it } from "vitest";
import { findMember } from "@/features/members/lib/mock-members";
import { MOCK_ACTIVITY_FEED } from "./mock-activity-feed";

describe("MOCK_ACTIVITY_FEED", () => {
  it("has between 10 and 15 events", () => {
    expect(MOCK_ACTIVITY_FEED.length).toBeGreaterThanOrEqual(10);
    expect(MOCK_ACTIVITY_FEED.length).toBeLessThanOrEqual(15);
  });

  it("has unique ids", () => {
    const ids = MOCK_ACTIVITY_FEED.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a non-empty actor, text and timestamp for every event", () => {
    for (const event of MOCK_ACTIVITY_FEED) {
      expect(event.actorUsername).toMatch(/\S/);
      expect(event.text).toMatch(/\S/);
      expect(event.timestamp).toMatch(/\S/);
    }
  });

  it("references only known group members", () => {
    for (const event of MOCK_ACTIVITY_FEED) {
      expect(findMember(event.actorUsername)).toBeDefined();
    }
  });

  it("is ordered chronologically, most recent event first", () => {
    const timestamps = MOCK_ACTIVITY_FEED.map((event) =>
      new Date(event.timestamp).getTime(),
    );
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });
});
