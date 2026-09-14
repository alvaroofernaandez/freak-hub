import { describe, expect, it } from "vitest";
import {
  pendingRecommendationsFor,
  type Recommendation,
  recommendationsForMember,
  sentRecommendationsBy,
} from "./recommendation";

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-1",
    fromUsername: "edward",
    toUsername: "alphonse",
    workTitle: "Fullmetal Alchemist: Brotherhood",
    reason: "Es literalmente nuestra historia, tienes que verlo.",
    status: "accepted",
  },
  {
    id: "rec-2",
    fromUsername: "gon",
    toUsername: "killua",
    workTitle: "Hunter x Hunter (2011)",
    reason: "El arco de la hormiga quimera te va a volar la cabeza.",
    status: "pending",
  },
  {
    id: "rec-3",
    fromUsername: "edward",
    toUsername: "gon",
    workTitle: "Steins;Gate",
    reason: "Va de gente que rompe las reglas del universo. Te sonará.",
    status: "dismissed",
  },
];

describe("recommendationsForMember", () => {
  it("returns recommendations sent or received by the given member", () => {
    const result = recommendationsForMember(RECOMMENDATIONS, "edward");

    expect(result).toContainEqual(RECOMMENDATIONS[0]);
    for (const recommendation of result) {
      expect(
        recommendation.fromUsername === "edward" ||
          recommendation.toUsername === "edward",
      ).toBe(true);
    }
  });

  it("returns an empty array for a member with no recommendations", () => {
    expect(recommendationsForMember(RECOMMENDATIONS, "nadie")).toEqual([]);
  });

  it("returns an empty array when there are no recommendations at all", () => {
    expect(recommendationsForMember([], "edward")).toEqual([]);
  });
});

describe("pendingRecommendationsFor", () => {
  it("returns only recommendations received by the member and still pending", () => {
    const result = pendingRecommendationsFor(RECOMMENDATIONS, "killua");

    expect(result).toEqual([RECOMMENDATIONS[1]]);
  });

  it("leaves out a recommendation the member sent, even while it is pending", () => {
    expect(pendingRecommendationsFor(RECOMMENDATIONS, "gon")).toEqual([]);
  });

  it("leaves out a received recommendation that is already answered", () => {
    expect(pendingRecommendationsFor(RECOMMENDATIONS, "alphonse")).toEqual([]);
  });
});

describe("sentRecommendationsBy", () => {
  it("returns every recommendation the member sent, whatever its status", () => {
    expect(sentRecommendationsBy(RECOMMENDATIONS, "edward")).toEqual([
      RECOMMENDATIONS[0],
      RECOMMENDATIONS[2],
    ]);
  });

  it("leaves out the recommendations the member received", () => {
    expect(sentRecommendationsBy(RECOMMENDATIONS, "alphonse")).toEqual([]);
  });

  it("returns an empty array when there are no recommendations at all", () => {
    expect(sentRecommendationsBy([], "edward")).toEqual([]);
  });
});
