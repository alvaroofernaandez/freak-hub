import Link from "next/link";
import type { CSSProperties } from "react";
import { Star } from "reicon-react";
import type {
  ActivityEntry,
  PendingRecommendation,
} from "@/features/home/lib/home-content";
import type { Work } from "@/features/library/lib/work";
import { cn } from "@/shared/lib/cn";
import { staggerStyle } from "@/shared/motion/tokens";
import { CATEGORY_COLOR_CLASS } from "@/shared/ui/category-stripe";
import { EmptyState } from "@/shared/ui/empty-state";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { StatusBadge } from "@/shared/ui/status-badge";

type HomeDashboardProps = {
  displayName: string;
  inProgressWorks: Work[];
  recommendations: PendingRecommendation[];
  activity: ActivityEntry[];
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
            {inProgressWorks.map((work, index) => (
              <ContinueCard key={work.id} work={work} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState
            size="inline"
            title="Nada en curso todavía"
            description="Empieza algo desde tu biblioteca para verlo aquí."
            action={
              <Link
                href="/biblioteca"
                className="rounded-lg border border-border px-3.5 py-2 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
              >
                Ir a tu biblioteca
              </Link>
            }
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Recomendaciones pendientes</h2>
        {recommendations.length > 0 ? (
          <ul className="space-y-2">
            {recommendations.map((recommendation) => (
              <li
                key={recommendation.id}
                className="rounded-lg border border-border bg-surface-raised p-4"
              >
                <p>
                  <span className="font-medium">
                    {recommendation.workTitle}
                  </span>{" "}
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
        ) : (
          <EmptyState
            size="inline"
            title="Sin recomendaciones pendientes"
            description="Nadie te ha recomendado nada todavía."
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Actividad reciente</h2>
        {activity.length > 0 ? (
          <ul className="space-y-1.5 font-mono text-sm text-ink-muted">
            {activity.map((entry) => (
              <li key={entry.id}>{entry.text}</li>
            ))}
          </ul>
        ) : (
          <EmptyState
            size="inline"
            title="Sin actividad reciente"
            description="Todavía no ha pasado nada en el grupo."
          />
        )}
      </section>
    </div>
  );
}

type ContinueCardProps = {
  work: Work;
  index: number;
};

/** A card in the "sigue donde lo dejaste" rail: cover, title, progress and a quick +1. */
function ContinueCard({ work, index }: ContinueCardProps) {
  const progress = work.progress ?? 0;

  return (
    <div
      data-testid="continue-card"
      className="stagger-in flex w-[210px] flex-none flex-col gap-2 md:w-[230px] lg:w-[280px]"
      style={staggerStyle(index) as CSSProperties}
    >
      <Link
        href={`/obras/${work.id}`}
        className="flex flex-col gap-2 transition-opacity duration-150 hover:opacity-90"
      >
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
              <Star size={16} weight="Filled" />
            </span>
          ) : null}
        </div>
        <span className="font-display text-sm leading-tight text-ink">
          {work.title}
        </span>
      </Link>
      <StatusBadge status={work.status} />
      <ProgressBar value={progress} label={`Progreso de ${work.title}`} />
    </div>
  );
}
