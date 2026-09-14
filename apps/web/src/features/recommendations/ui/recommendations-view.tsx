import {
  pendingRecommendationsFor,
  type Recommendation,
  sentRecommendationsBy,
} from "@/features/profile/lib/recommendation";
import { RecommendationCard } from "@/features/profile/ui/recommendation-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Moulding } from "@/shared/ui/moulding";
import { SectionHeading } from "@/shared/ui/section-heading";

type RecommendationsViewProps = {
  recommendations: Recommendation[];
  viewerUsername: string;
};

/**
 * The two questions /recomendaciones answers (docs/screens.md): what is
 * waiting on you, and what you have sent. The profile section answers a third
 * one — everything between you and one other member — which is why this is a
 * screen of its own and not that section widened.
 *
 * Both blocks are read-only. Accepting or dismissing needs the recommendations
 * endpoint that does not exist yet (docs/roadmap.md), and a button that only
 * pretends to answer would be worse than no button.
 */
export function RecommendationsView({
  recommendations,
  viewerUsername,
}: RecommendationsViewProps) {
  const received = pendingRecommendationsFor(recommendations, viewerUsername);
  const sent = sentRecommendationsBy(recommendations, viewerUsername);

  return (
    <>
      <section aria-label="Recibidas pendientes" className="space-y-4">
        <SectionHeading
          title="Recibidas pendientes"
          count={received.length}
          description="Lo que te han recomendado y todavía no has respondido."
        />
        {received.length > 0 ? (
          <ul className="space-y-3">
            {received.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                viewerUsername={viewerUsername}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            size="inline"
            title="Nada pendiente"
            description="Cuando alguien del grupo te recomiende algo, lo verás aquí con su motivo."
          />
        )}
      </section>

      <Moulding />

      <section aria-label="Enviadas" className="space-y-4">
        <SectionHeading
          title="Enviadas"
          count={sent.length}
          description="Lo que has recomendado tú, con el estado en el que quedó."
        />
        {sent.length > 0 ? (
          <ul className="space-y-3">
            {sent.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                viewerUsername={viewerUsername}
                showStatus
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            size="inline"
            title="Todavía no has recomendado nada"
            description="Recomienda una obra desde su ficha y aparecerá aquí hasta que te contesten."
          />
        )}
      </section>
    </>
  );
}
