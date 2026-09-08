import Link from "next/link";
import type {
  MockActivityEntry,
  MockRecommendation,
} from "@/features/home/lib/mock-home";
import type { MockWork } from "@/features/library/lib/mock-works";
import { cn } from "@/shared/lib/cn";
import { CATEGORY_COLOR_CLASS } from "@/shared/ui/category-stripe";
import { StatusBadge } from "@/shared/ui/status-badge";

type HomeDashboardProps = {
  displayName: string;
  inProgressWorks: MockWork[];
  recommendations: MockRecommendation[];
  activity: MockActivityEntry[];
};

/** The /inicio panel: what's in progress, pending recommendations, recent activity. */
export function HomeDashboard({
  displayName,
  inProgressWorks,
  recommendations,
  activity,
}: HomeDashboardProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[22px] font-bold text-ink md:text-[24px] lg:text-[27px]">
          Hola, {displayName}
        </h1>
        <p className="mt-1 text-[12px] text-ink-muted lg:text-[13px]">
          Esto es lo que pasa en tu biblioteca
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-[14px] font-bold text-ink lg:text-[15px]">
          Sigue donde lo dejaste
        </h2>
        {inProgressWorks.length > 0 ? (
          <div
            data-testid="continue-rail"
            className="flex gap-3 overflow-x-auto pb-1 md:gap-4 lg:gap-5"
          >
            {inProgressWorks.map((work) => (
              <ContinueCard key={work.id} work={work} />
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

type ContinueCardProps = {
  work: MockWork;
};

/** A card in the "sigue donde lo dejaste" rail: cover, title, progress and a quick +1. */
function ContinueCard({ work }: ContinueCardProps) {
  const progress = work.progress ?? 0;

  return (
    <div
      data-testid="continue-card"
      className="flex w-[210px] flex-none flex-col gap-2 md:w-[230px] lg:w-[280px]"
    >
      <Link href={`/obras/${work.id}`} className="flex flex-col gap-2">
        <div
          className={cn(
            "flex h-[110px] flex-col justify-end rounded-xl p-3 text-accent-ink md:h-[120px] lg:h-[140px]",
            CATEGORY_COLOR_CLASS[work.category],
          )}
        >
          {work.isFavourite ? (
            <span
              role="img"
              aria-label="Favorito"
              className="self-end text-base"
            >
              ★
            </span>
          ) : null}
        </div>
        <span className="font-display text-sm leading-tight text-ink">
          {work.title}
        </span>
      </Link>
      <StatusBadge status={work.status} />
      <div className="h-[5px] overflow-hidden rounded-full bg-border-soft">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-end">
        <span className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-ink">
          +1
        </span>
      </div>
    </div>
  );
}
