import Link from "next/link";
import { Star } from "reicon-react";
import type { Work } from "@/features/library/lib/work";
import { CoverPlaceholder } from "@/features/library/ui/cover-placeholder";
import { cn } from "@/shared/lib/cn";
import { interactiveCardClasses } from "@/shared/ui/interactive-card";
import { StatusBadge } from "@/shared/ui/status-badge";

type WorkCardProps = {
  work: Work;
};

/**
 * A work in a library listing: a neutral card (docs/design/high-fidelity-desktop.html
 * §3 · BIBLIOTECA POR CATEGORÍA) with a cover placeholder (no cover art exists
 * yet, see docs/roadmap.md), title below it, and status/rating below that.
 * `StatusBadge` is the only carrier of status meaning — category color plays
 * no part here (docs/design.md, same reasoning already applied to
 * `CategoryTile` in #23).
 */
export function WorkCard({ work }: WorkCardProps) {
  return (
    <Link
      href={`/obras/${work.id}`}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-surface",
        interactiveCardClasses(work.category),
      )}
    >
      <div className="relative">
        <CoverPlaceholder
          testId="work-card-cover"
          className="h-[150px] w-full rounded-none"
        />
        {work.isFavourite ? (
          <span
            role="img"
            aria-label="Favorito"
            className="absolute right-2 top-2 text-lg"
          >
            <Star size={18} weight="Filled" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 p-3">
        <span
          data-testid="work-card-title"
          className="font-display text-base leading-tight text-ink"
        >
          {work.title}
        </span>
        <div className="flex items-center justify-between">
          <StatusBadge status={work.status} />
          {work.rating ? (
            <span className="font-mono text-sm text-ink-muted">
              {work.rating}/10
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
