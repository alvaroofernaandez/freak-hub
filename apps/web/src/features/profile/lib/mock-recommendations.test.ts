import { describe, expect, it } from "vitest";
import {
  MOCK_RECOMMENDATIONS,
  recommendationsForMember,
} from "./mock-recommendations";

describe("MOCK_RECOMMENDATIONS", () => {
  it("has at least four recommendations, each with a non-empty reason", () => {
    expect(MOCK_RECOMMENDATIONS.length).toBeGreaterThanOrEqual(4);
    for (const recommendation of MOCK_RECOMMENDATIONS) {
      expect(recommendation.reason).toMatch(/\S/);
      expect(recommendation.fromUsername).not.toBe(recommendation.toUsername);
    }
  });
});

describe("recommendationsForMember", () => {
  it("returns recommendations sent or received by the given member", () => {
    const [first] = MOCK_RECOMMENDATIONS;
    const result = recommendationsForMember(
      MOCK_RECOMMENDATIONS,
      first.fromUsername,
    );

    expect(result).toContainEqual(first);
    for (const recommendation of result) {
      expect(
        recommendation.fromUsername === first.fromUsername ||
          recommendation.toUsername === first.fromUsername,
      ).toBe(true);
    }
  });

  it("returns an empty array for a member with no recommendations", () => {
    expect(recommendationsForMember(MOCK_RECOMMENDATIONS, "nadie")).toEqual(
      [],
    );
  });
});
