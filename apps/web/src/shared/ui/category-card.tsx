import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Plus } from "reicon-react";
import { cn } from "@/shared/lib/cn";
import { AnimatedNumber } from "./animated-number";
import { CATEGORY_ART, CATEGORY_TEXT_CLASS, stageGlow } from "./category-art";
import {
  CATEGORY_ACCENT_CLASS,
  CATEGORY_LABELS,
  type CategoryId,
} from "./category-stripe";
import { interactiveCardClasses } from "./interactive-card";

type CategoryCardBaseProps = {
  category: CategoryId;
  /** "roster" in the library lobby, "compact" in the add picker. */
  size?: "roster" | "compact";
  /** Works in the category. Omitted where a figure means nothing (the picker). */
  count?: number;
  /** Merged onto the root element, e.g. `.stagger-in` for a cascading grid. */
  className?: string;
  /** Merged onto the root element, e.g. the `--i` stagger index. */
  style?: CSSProperties;
};

type CategoryCardLinkProps = CategoryCardBaseProps & {
  href: string;
  onSelect?: never;
  selected?: never;
};

type CategoryCardButtonProps = CategoryCardBaseProps & {
  onSelect: () => void;
  /** True while the choice is being confirmed, before navigating away. */
  selected?: boolean;
  href?: never;
};

export type CategoryCardProps = CategoryCardLinkProps | CategoryCardButtonProps;

const SIZE = {
  roster: {
    card: "h-[190px] p-5 md:h-[210px] lg:h-[230px] lg:p-6",
    name: "text-xl lg:text-2xl",
    nameWidth: "max-w-[62%]",
    art: "top-3 w-[52%]",
    sizes: "(min-width: 640px) 22vw, 45vw",
  },
  compact: {
    card: "h-[128px] p-3.5 sm:h-[148px] sm:p-4",
    name: "text-[15px] sm:text-base",
    nameWidth: "max-w-[68%]",
    art: "top-2 w-[50%]",
    sizes: "(min-width: 640px) 120px, 40vw",
  },
} as const;

/** Only for assistive tech: the card shows the bare figure. */
function pluralizeWorks(count: number): string {
  return count === 1 ? "1 obra" : `${count} obras`;
}

/**
 * One category as a slot in the roster (docs/design.md#las-tarjetas-de-categoria-llevan-personaje):
 * its character stands in a pool of the category's light and steps forward
 * when the slot is pointed at, focused or picked.
 *
 * The same card serves the library lobby, where it is a link into the
 * category, and the add picker, where it is a button that starts adding a
 * work. One component, so both screens speak the same visual language.
 *
 * Everything inside is a <span>: a <button> only accepts phrasing content.
 */
export function CategoryCard(props: CategoryCardProps) {
  const { category, size = "roster", count, style } = props;
  const dims = SIZE[size];
  const art = CATEGORY_ART[category];
  const isLink = typeof props.href === "string";
  const selected = !isLink && props.selected === true;
  const CornerIcon = isLink ? ArrowRight : Plus;

  const className = cn(
    "group relative isolate flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface text-left",
    dims.card,
    interactiveCardClasses(category),
    selected &&
      cn(
        CATEGORY_ACCENT_CLASS[category],
        "ring-2 ring-current ring-offset-2 ring-offset-surface motion-safe:scale-[1.02]",
      ),
    props.className,
  );

  const content = (
    <>
      <span
        aria-hidden="true"
        data-testid="category-card-glow"
        style={{ backgroundImage: stageGlow(category) }}
        className={cn(
          "pointer-events-none absolute inset-0 opacity-70",
          "transition-opacity duration-[220ms] ease-out-quint motion-reduce:transition-none",
          "group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[selected]:opacity-100",
        )}
      />

      {/* A hairline of light along the top edge, so the card reads as a raised
          surface catching the same light as the stage. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/15 to-transparent"
      />

      {art ? (
        <span
          aria-hidden="true"
          data-testid="category-card-art"
          data-art={art}
          className={cn(
            "pointer-events-none absolute right-0 bottom-0",
            dims.art,
            // Fades before it reaches the name, so the art never fights the text.
            "[mask-image:linear-gradient(to_right,transparent,black_28%)]",
          )}
        >
          {/* The character steps forward by growing from the corner it is
              anchored to, so it never lifts off the card's bottom edge. */}
          <span
            className={cn(
              "absolute inset-0 origin-bottom-right",
              "motion-safe:transition-transform motion-safe:duration-[220ms] motion-safe:ease-out-quint",
              "motion-safe:group-hover:scale-[1.04] motion-safe:group-focus-visible:scale-[1.04] motion-safe:group-data-[selected]:scale-[1.04]",
            )}
          >
            <Image
              src={art}
              alt=""
              fill
              sizes={dims.sizes}
              className="object-contain object-bottom-right"
            />
          </span>
        </span>
      ) : null}

      <span className="relative z-10 flex items-start gap-2">
        {count === undefined ? null : (
          <span
            data-testid="category-card-count"
            aria-hidden="true"
            className="rounded-full border border-border-soft bg-ground/70 px-2 py-0.5 font-mono text-xs tabular-nums text-ink-muted"
          >
            {/* The pluralized "N obras" text next to the name (below) is
                the accessible figure; this chip is `aria-hidden` as a
                whole, so AnimatedNumber's own internal sr-only span is
                harmlessly hidden along with it. */}
            <AnimatedNumber value={count} />
          </span>
        )}
        <CornerIcon
          size={16}
          aria-hidden="true"
          className={cn(
            "ml-auto text-ink-muted opacity-0",
            "transition-opacity duration-150 ease-out-quint motion-reduce:transition-none",
            "group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[selected]:opacity-100",
          )}
        />
      </span>

      <span className={cn("relative z-10 block", dims.nameWidth)}>
        <span
          data-testid="category-card-name"
          className={cn(
            "block font-display leading-[1.1] text-balance",
            dims.name,
            CATEGORY_TEXT_CLASS[category],
          )}
        >
          {CATEGORY_LABELS[category]}
        </span>
        {count === undefined ? null : (
          <span className="sr-only">{pluralizeWorks(count)}</span>
        )}
      </span>
    </>
  );

  if (isLink) {
    return (
      <Link
        href={props.href}
        data-testid="category-card"
        className={className}
        style={style}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onSelect}
      data-testid="category-card"
      data-selected={selected || undefined}
      className={className}
      style={style}
    >
      {content}
    </button>
  );
}
