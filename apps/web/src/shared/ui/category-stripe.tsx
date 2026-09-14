import type { WorkCategory } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";

const SEGMENTS: { id: WorkCategory; colorClass: string }[] = [
  { id: "anime", colorClass: "bg-cat-anime" },
  { id: "manga", colorClass: "bg-cat-manga" },
  { id: "game", colorClass: "bg-cat-games" },
  { id: "film", colorClass: "bg-cat-films" },
  { id: "boardgame", colorClass: "bg-cat-board" },
  { id: "tcg", colorClass: "bg-cat-tcg" },
];

/** The six categories, in their canonical order (docs/screens.md). */
export const CATEGORY_ORDER: WorkCategory[] = SEGMENTS.map(
  (segment) => segment.id,
);

/** Category -> stripe color class, the single source of truth for the roster colors. */
export const CATEGORY_COLOR_CLASS: Record<WorkCategory, string> =
  Object.fromEntries(
    SEGMENTS.map((segment) => [segment.id, segment.colorClass]),
  ) as Record<WorkCategory, string>;

/**
 * Category -> "border + text" classes: color as an accent (outline), never a
 * solid fill (docs/design/high-fidelity-desktop.html §4, same criterion
 * applied to the lobby tile in issue #23).
 */
export const CATEGORY_ACCENT_CLASS: Record<WorkCategory, string> =
  Object.fromEntries(
    SEGMENTS.map((segment) => [
      segment.id,
      cn(
        segment.colorClass.replace("bg-", "border-"),
        segment.colorClass.replace("bg-", "text-"),
      ),
    ]),
  ) as Record<WorkCategory, string>;

/** Category -> Spanish display label. */
export const CATEGORY_LABELS: Record<WorkCategory, string> = {
  anime: "Anime",
  manga: "Manga",
  game: "Videojuegos",
  film: "Películas",
  boardgame: "Juegos de mesa",
  tcg: "TCG",
};

type CategoryStripeProps = {
  activeCategory?: WorkCategory;
};

/** The "moldura": the six-color category stripe below the navbar (docs/design.md). */
export function CategoryStripe({ activeCategory }: CategoryStripeProps) {
  return (
    <div
      data-testid="category-stripe"
      aria-hidden="true"
      className="flex h-2 w-full"
    >
      {SEGMENTS.map((segment) => (
        <div
          key={segment.id}
          data-testid="category-stripe-segment"
          data-category={segment.id}
          className={cn(
            segment.colorClass,
            // The stripe is a persistent chrome element: it eases rather than
            // snapping, but stays still for anyone who asked for less motion.
            "transition-[flex-grow] duration-200 ease-out motion-reduce:transition-none",
            segment.id === activeCategory ? "flex-[2]" : "flex-1",
          )}
        />
      ))}
    </div>
  );
}
