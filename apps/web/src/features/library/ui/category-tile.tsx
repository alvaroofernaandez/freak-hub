import Link from "next/link";
import {
  CATEGORY_COLOR_CLASS,
  CATEGORY_LABELS,
  type CategoryId,
} from "@/shared/ui/category-stripe";
import { cn } from "@/shared/lib/cn";

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
      className={cn(
        "flex flex-col justify-between gap-8 rounded-xl p-6 text-accent-ink transition-opacity hover:opacity-90",
        CATEGORY_COLOR_CLASS[category],
      )}
    >
      <span className="font-display text-xl">{CATEGORY_LABELS[category]}</span>
      <span className="font-mono text-sm uppercase tracking-widest">
        {pluralizeWorks(count)}
      </span>
    </Link>
  );
}
