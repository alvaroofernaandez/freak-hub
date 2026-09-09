import { describe, expect, it } from "vitest";
import {
  type Recommendation,
  recommendationsForMember,
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
