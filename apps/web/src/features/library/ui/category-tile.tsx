import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "reicon-react";
import {
  CATEGORY_ART,
  CATEGORY_TEXT_CLASS,
  cornerGlow,
} from "@/features/library/lib/category-art";
import { cn } from "@/shared/lib/cn";
import { CATEGORY_LABELS, type CategoryId } from "@/shared/ui/category-stripe";
import { interactiveCardClasses } from "@/shared/ui/interactive-card";

type CategoryTileProps = {
  category: CategoryId;
  count: number;
  href: string;
};

/** Only for assistive tech: the tile shows the bare figure. */
function pluralizeWorks(count: number): string {
  return count === 1 ? "1 obra" : `${count} obras`;
}

/**
 * The lobby's entry point into one category (docs/screens.md#lobby-de-biblioteca).
 *
 * Each category is a character in the roster (docs/design.md#el-concepto):
 * its name carries its own colour and its character leans in from the right
 * edge. The artwork is decoration, so it fades out well before the text and
 * never competes with the count.
 */
export function CategoryTile({ category, count, href }: CategoryTileProps) {
  const art = CATEGORY_ART[category];

  return (
    <Link
      href={href}
      data-testid="category-tile"
      className={cn(
        "group relative flex h-[190px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-5 md:h-[210px] lg:h-[230px] lg:p-6",
        interactiveCardClasses(category),
      )}
    >
      <div
        aria-hidden="true"
        data-testid="category-tile-glow"
        style={{ backgroundImage: cornerGlow(category) }}
        className="pointer-events-none absolute inset-0 opacity-80 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none"
      />

      {/* A hairline of light along the top edge, so the card reads as a raised
          surface catching the same light as the corner. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/15 to-transparent"
      />

      {art ? (
        <div
          aria-hidden="true"
          data-testid="category-tile-art"
          data-art={art}
          className={cn(
            "pointer-events-none absolute right-0 bottom-0 top-3 w-[52%]",
            // Fades before it reaches the name, so the art never fights the text.
            "[mask-image:linear-gradient(to_right,transparent,black_28%)]",
          )}
        >
          <Image
            src={art}
            alt=""
            fill
            sizes="(min-width: 640px) 22vw, 45vw"
            className="object-contain object-bottom-right"
          />
        </div>
      ) : null}

      <div className="relative z-10 flex justify-end">
        <ArrowRight
          size={16}
          aria-hidden="true"
          className="text-ink-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none"
        />
      </div>

      <div className="relative z-10 flex max-w-[62%] items-baseline gap-2.5">
        <p
          data-testid="category-tile-name"
          className={cn(
            "font-display text-xl leading-tight lg:text-2xl",
            CATEGORY_TEXT_CLASS[category],
          )}
        >
          {CATEGORY_LABELS[category]}
        </p>
        <span
          data-testid="category-tile-count"
          aria-hidden="true"
          className="font-mono text-sm text-ink-muted lg:text-base"
        >
          {count}
        </span>
        <span className="sr-only">{pluralizeWorks(count)}</span>
      </div>
    </Link>
  );
}
