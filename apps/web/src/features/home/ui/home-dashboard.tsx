import type {
  MockActivityEntry,
  MockRecommendation,
} from "@/features/home/lib/mock-home";
import type { MockWork } from "@/features/library/lib/mock-works";
import { WorkCard } from "@/features/library/ui/work-card";

type HomeDashboardProps = {
  inProgressWorks: MockWork[];
  recommendations: MockRecommendation[];
  activity: MockActivityEntry[];
};

/** The /inicio panel: what's in progress, pending recommendations, recent activity. */
export function HomeDashboard({
  inProgressWorks,
  recommendations,
  activity,
}: HomeDashboardProps) {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">En curso</h2>
        {inProgressWorks.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {inProgressWorks.map((work) => (
              <WorkCard key={work.id} work={work} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            Nada en curso todavía. Añade algo desde tu biblioteca.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Recomendaciones pendientes</h2>
        <ul className="space-y-2">
          {recommendations.map((recommendation) => (
            <li
              key={recommendation.id}
              className="rounded-lg border border-border bg-surface-raised p-4"
            >
              <p>
                <span className="font-medium">{recommendation.workTitle}</span>{" "}
                <span className="text-ink-muted">
                  · de @{recommendation.fromUsername}
                </span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {recommendation.reason}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Actividad reciente</h2>
        <ul className="space-y-1.5 font-mono text-sm text-ink-muted">
          {activity.map((entry) => (
            <li key={entry.id}>{entry.text}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
