import Link from "next/link";
import type { MockWork } from "@/features/library/lib/mock-works";
import { cn } from "@/shared/lib/cn";
import { CATEGORY_COLOR_CLASS } from "@/shared/ui/category-stripe";
import { StatusBadge } from "@/shared/ui/status-badge";

type WorkCardProps = {
  work: MockWork;
};

/**
 * A work in a library listing: a category-colored cover (no cover art exists
 * yet, see docs/roadmap.md) with the title, its status and rating.
 */
export function WorkCard({ work }: WorkCardProps) {
  return (
    <Link href={`/obras/${work.id}`} className="flex flex-col gap-2">
      <div
        data-testid="work-card-cover"
        className={cn(
          "flex aspect-[3/4] flex-col justify-between rounded-xl p-4 text-accent-ink",
          CATEGORY_COLOR_CLASS[work.category],
        )}
      >
        <div className="flex justify-end">
          {work.isFavourite ? (
            <span role="img" aria-label="Favorito" className="text-lg">
              ★
            </span>
          ) : null}
        </div>
        <span className="font-display text-base leading-tight">
          {work.title}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <StatusBadge status={work.status} />
        {work.rating ? (
          <span className="font-mono text-sm text-ink-muted">
            {work.rating}/10
          </span>
        ) : null}
      </div>
    </Link>
  );
}
