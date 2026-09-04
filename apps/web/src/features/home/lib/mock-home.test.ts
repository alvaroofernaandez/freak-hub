import { describe, expect, it } from "vitest";
import { MOCK_PENDING_RECOMMENDATIONS, MOCK_RECENT_ACTIVITY } from "./mock-home";

describe("MOCK_PENDING_RECOMMENDATIONS", () => {
  it("has at least two recommendations, each with a reason", () => {
    expect(MOCK_PENDING_RECOMMENDATIONS.length).toBeGreaterThanOrEqual(2);
    for (const recommendation of MOCK_PENDING_RECOMMENDATIONS) {
      expect(recommendation.workTitle).toMatch(/\S/);
      expect(recommendation.fromUsername).toMatch(/\S/);
      expect(recommendation.reason).toMatch(/\S/);
    }
  });
});

describe("MOCK_RECENT_ACTIVITY", () => {
  it("has at least three activity entries with text", () => {
    expect(MOCK_RECENT_ACTIVITY.length).toBeGreaterThanOrEqual(3);
    for (const entry of MOCK_RECENT_ACTIVITY) {
      expect(entry.text).toMatch(/\S/);
    }
  });
});
