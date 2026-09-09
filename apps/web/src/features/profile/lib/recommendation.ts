export type RecommendationStatus = "pending" | "accepted" | "dismissed";

export type Recommendation = {
  id: string;
  fromUsername: string;
  toUsername: string;
  workTitle: string;
  /** Mandatory: a recommendation without a reason is not one (docs/domain.md). */
  reason: string;
  status: RecommendationStatus;
};

export function recommendationsForMember(
  recommendations: Recommendation[],
  username: string,
): Recommendation[] {
  return recommendations.filter(
    (recommendation) =>
      recommendation.fromUsername === username ||
      recommendation.toUsername === username,
  );
}
