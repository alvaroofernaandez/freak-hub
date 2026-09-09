import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import {
  CATEGORY_COLOR_CLASS,
  CATEGORY_LABELS,
  type CategoryId,
} from "@/shared/ui/category-stripe";

type CategoryTileProps = {
  category: CategoryId;
  count: number;
  href: string;
};

function pluralizeWorks(count: number): string {
  return count === 1 ? "1 obra" : `${count} obras`;
}

/** The lobby's entry point into one category (docs/screens.md#lobby-de-biblioteca). */
export function CategoryTile({ category, count, href }: CategoryTileProps) {
  return (
    <Link
      href={href}
      data-testid="category-tile"
      className="relative flex h-[132px] flex-col justify-between rounded-[14px] border border-border bg-surface p-4 transition-opacity hover:opacity-90 md:h-[150px] md:p-5 lg:h-[172px] lg:p-6"
    >
      <div
        data-testid="category-tile-icon"
        className={cn(
          "h-[22px] w-[22px] rounded-[6px] md:h-6 md:w-6 lg:h-[26px] lg:w-[26px] lg:rounded-[7px]",
          CATEGORY_COLOR_CLASS[category],
        )}
      />
      <div>
        <p className="text-[15px] font-bold text-ink md:text-[17px] lg:text-[19px]">
          {CATEGORY_LABELS[category]}
        </p>
        <p className="mt-[3px] font-mono text-[11px] text-ink-muted md:text-xs lg:mt-1">
          {pluralizeWorks(count)}
        </p>
      </div>
      <span
        aria-hidden="true"
        className="absolute hidden text-[15px] text-ink-faint md:bottom-4 md:right-5 md:block lg:bottom-5 lg:right-6 lg:text-base"
      >
        →
      </span>
    </Link>
  );
}
