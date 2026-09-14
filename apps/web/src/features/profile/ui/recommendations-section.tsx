import type { Recommendation } from "@/features/profile/lib/recommendation";
import { EmptyState } from "@/shared/ui/empty-state";
import { RecommendationCard } from "./recommendation-card";

type RecommendationsSectionProps = {
  recommendations: Recommendation[];
  ownerUsername: string;
};

/** Recommendations sent and received by the profile owner, with their reason (ADR-0010). */
export function RecommendationsSection({
  recommendations,
  ownerUsername,
}: RecommendationsSectionProps) {
  if (recommendations.length === 0) {
    return (
      <EmptyState
        title="Sin recomendaciones todavía"
        description="Aquí aparecerán las recomendaciones que envíes o recibas."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {recommendations.map((recommendation) => (
        <RecommendationCard
          key={recommendation.id}
          recommendation={recommendation}
          viewerUsername={ownerUsername}
        />
      ))}
    </ul>
  );
}
