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

/**
 * The inbox of /recomendaciones: what other members sent this one and it has
 * not answered yet. A recommendation you sent is never in your own inbox, and
 * one you already accepted or dismissed has left it.
 */
export function pendingRecommendationsFor(
  recommendations: Recommendation[],
  username: string,
): Recommendation[] {
  return recommendations.filter(
    (recommendation) =>
      recommendation.toUsername === username &&
      recommendation.fromUsername !== username &&
      recommendation.status === "pending",
  );
}

/**
 * The outbox of /recomendaciones: everything this member sent, in every
 * status. Unlike the inbox, an answered recommendation stays here — knowing
 * that what you sent was dismissed is the point of the list.
 */
export function sentRecommendationsBy(
  recommendations: Recommendation[],
  username: string,
): Recommendation[] {
  return recommendations.filter(
    (recommendation) => recommendation.fromUsername === username,
  );
}
