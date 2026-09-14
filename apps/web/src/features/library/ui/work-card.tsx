import Link from "next/link";
import { Star } from "reicon-react";
import {
  type LibraryItem,
  progressLabel,
} from "@/features/library/lib/library-item";
import { CoverPlaceholder } from "@/features/library/ui/cover-placeholder";
import { cn } from "@/shared/lib/cn";
import { interactiveCardClasses } from "@/shared/ui/interactive-card";
import { StatusBadge } from "@/shared/ui/status-badge";

type WorkCardProps = {
  item: LibraryItem;
};

/**
 * One library entry in a listing: a neutral card (docs/design/high-fidelity-desktop.html
 * §3 · BIBLIOTECA POR CATEGORÍA) with a cover placeholder (no cover art exists
 * yet, see docs/roadmap.md), title below it, and status/rating below that.
 * `StatusBadge` is the only carrier of status meaning — category color plays
 * no part here (docs/design.md, same reasoning already applied to
 * `CategoryCard`, first in #23).
 *
 * The card links with the **entry's** id, not the work's: `/obras/[id]` reads
 * `GET /v1/library/{id}`.
 */
export function WorkCard({ item }: WorkCardProps) {
  const progress = progressLabel(item);

  return (
    <Link
      href={`/obras/${item.id}`}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-surface",
        interactiveCardClasses(item.category),
      )}
    >
      <div className="relative">
        <CoverPlaceholder
          testId="work-card-cover"
          className="h-[150px] w-full rounded-none"
        />
        {item.isFavourite ? (
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
          {item.title}
        </span>
        <div className="flex items-center justify-between">
          <StatusBadge status={item.status} />
          {item.rating === null ? null : (
            <span className="font-mono text-sm text-ink-muted">
              {item.rating}/10
            </span>
          )}
        </div>
        {/* The mockup's progress line, which had nothing to print until the
            library endpoint landed. In `--ink-muted`, not the mockup's
            `--ink-faint`: that token does not clear 4.5:1 on this surface and
            `app/token-contrast.test.ts` refuses it for readable text. */}
        {progress ? (
          <span
            data-testid="work-card-progress"
            className="font-mono text-[11px] text-ink-muted"
          >
            {progress}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
