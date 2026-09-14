import type { Recommendation } from "@/features/profile/lib/recommendation";
import { RecommendationStatusBadge } from "./recommendation-status-badge";

type RecommendationCardProps = {
  recommendation: Recommendation;
  /** Whose side of the exchange the card is written from. */
  viewerUsername: string;
  /**
   * Sent recommendations carry their state; a list that is already filtered
   * down to what is pending would only repeat the same word on every row.
   */
  showStatus?: boolean;
};

/**
 * One recommendation, from the point of view of whoever is reading it: who it
 * is with, the work, and the reason, which is the part that makes it a
 * recommendation and not a link (docs/domain.md).
 *
 * Shared by the profile section (ADR-0010) and the /recomendaciones screen so
 * the two never drift into two different cards for the same thing.
 */
export function RecommendationCard({
  recommendation,
  viewerUsername,
  showStatus = false,
}: RecommendationCardProps) {
  const sentByViewer = recommendation.fromUsername === viewerUsername;

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          {sentByViewer
            ? `Enviada a @${recommendation.toUsername}`
            : `Recibida de @${recommendation.fromUsername}`}
        </p>
        {showStatus ? (
          <RecommendationStatusBadge status={recommendation.status} />
        ) : null}
      </div>
      <p className="mt-1 font-medium">{recommendation.workTitle}</p>
      <p className="mt-1 max-w-[62ch] text-pretty text-sm text-ink-muted">
        {recommendation.reason}
      </p>
    </li>
  );
}
