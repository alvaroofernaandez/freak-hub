import type { MockRecommendation } from "@/features/profile/lib/mock-recommendations";

type RecommendationsSectionProps = {
  recommendations: MockRecommendation[];
  ownerUsername: string;
};

/** Recommendations sent and received by the profile owner, with their reason (ADR-0010). */
export function RecommendationsSection({
  recommendations,
  ownerUsername,
}: RecommendationsSectionProps) {
  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-ink-muted">Sin recomendaciones todavía.</p>
    );
  }

  return (
    <ul className="space-y-3">
      {recommendations.map((recommendation) => {
        const sentByOwner = recommendation.fromUsername === ownerUsername;

        return (
          <li
            key={recommendation.id}
            className="rounded-lg border border-border bg-surface-raised p-4"
          >
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
              {sentByOwner
                ? `Enviada a @${recommendation.toUsername}`
                : `Recibida de @${recommendation.fromUsername}`}
            </p>
            <p className="mt-1 font-medium">{recommendation.workTitle}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {recommendation.reason}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
