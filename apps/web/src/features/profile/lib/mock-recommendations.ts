export type MockRecommendationStatus = "pending" | "accepted" | "dismissed";

export type MockRecommendation = {
  id: string;
  fromUsername: string;
  toUsername: string;
  workTitle: string;
  /** Mandatory: a recommendation without a reason is not one (docs/domain.md). */
  reason: string;
  status: MockRecommendationStatus;
};

/**
 * Fake recommendations standing in for the future recommendations endpoint
 * (docs/roadmap.md). Delete once the profile reads them for real.
 */
export const MOCK_RECOMMENDATIONS: MockRecommendation[] = [
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
    fromUsername: "killua",
    toUsername: "gon",
    workTitle: "Wingspan",
    reason: "Encaja con lo tranquilo que te gusta jugar en mesa.",
    status: "pending",
  },
  {
    id: "rec-4",
    fromUsername: "alphonse",
    toUsername: "edward",
    workTitle: "Vinland Saga",
    reason: "El cambio de tono a partir del segundo arco te va a interesar.",
    status: "dismissed",
  },
  {
    id: "rec-5",
    fromUsername: "edward",
    toUsername: "gon",
    workTitle: "Elden Ring",
    reason: "Es del mismo estudio que Dark Souls, que tanto te gustó.",
    status: "accepted",
  },
];

export function recommendationsForMember(
  recommendations: MockRecommendation[],
  username: string,
): MockRecommendation[] {
  return recommendations.filter(
    (recommendation) =>
      recommendation.fromUsername === username ||
      recommendation.toUsername === username,
  );
}
