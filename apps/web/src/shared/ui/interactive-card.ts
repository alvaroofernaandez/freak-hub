import type { CategoryId } from "./category-stripe";

/**
 * Tailwind cannot see a class name built at runtime, so the hover border is
 * written out per category rather than derived from CATEGORY_COLOR_CLASS.
 */
const HOVER_BORDER: Record<CategoryId, string> = {
  anime: "hover:border-cat-anime focus-visible:border-cat-anime",
  manga: "hover:border-cat-manga focus-visible:border-cat-manga",
  game: "hover:border-cat-games focus-visible:border-cat-games",
  film: "hover:border-cat-films focus-visible:border-cat-films",
  boardgame: "hover:border-cat-board focus-visible:border-cat-board",
  tcg: "hover:border-cat-tcg focus-visible:border-cat-tcg",
};

/**
 * Shared hover/focus behaviour for the cards that open something: a small
 * lift plus a border in the category's colour (#40). Keyboard focus gets the
 * same treatment as the pointer, so the affordance is not mouse-only.
 *
 * The lift never reflows the grid around it. Tailwind 4's `scale-*` writes the
 * `scale` property, not `transform`, so that is what the transition names; and
 * since `transform: none` cannot cancel a `scale`, the lift only exists under
 * `motion-safe:` rather than being switched off for reduced motion afterwards.
 */
export function interactiveCardClasses(category: CategoryId): string {
  return [
    "transition-[scale,border-color] duration-150 ease-out-quint",
    "motion-safe:hover:scale-[1.02] motion-safe:focus-visible:scale-[1.02]",
    HOVER_BORDER[category],
    "motion-reduce:transition-none",
  ].join(" ");
}
