import type { CategoryId } from "@/shared/ui/category-stripe";

/**
 * A character standing in for each category, cut out and served from /public.
 * All six are 700px tall; the taller subjects carry transparent headroom so the
 * tile scales them down to a similar visual weight.
 *
 * The filename names the subject on purpose. `next/image` keys its cache on the
 * URL, so swapping a character while keeping the filename serves the old
 * picture from cache: renaming the file is what actually replaces it.
 */
export const CATEGORY_ART: Record<CategoryId, string> = {
  anime: "/char-anime-ed.webp",
  manga: "/char-manga-asta.webp",
  game: "/char-game-arthur.webp",
  film: "/char-film-vader.webp",
  boardgame: "/char-boardgame-knight.webp",
  tcg: "/char-tcg-booster.webp",
};

/**
 * Category -> its CSS custom property. Used to build the corner glow inline:
 * a Tailwind class cannot carry a runtime colour, and a radial gradient with a
 * soft falloff is not expressible with `from-*`/`to-*` utilities.
 */
export const CATEGORY_COLOR_VAR: Record<CategoryId, string> = {
  anime: "--color-cat-anime",
  manga: "--color-cat-manga",
  game: "--color-cat-games",
  film: "--color-cat-films",
  boardgame: "--color-cat-board",
  tcg: "--color-cat-tcg",
};

/**
 * The corner glow: light entering from the top-left, fading out well before it
 * reaches the character on the right. `color-mix` keeps it at a low intensity
 * without needing a second token per category.
 */
export function cornerGlow(category: CategoryId): string {
  const colour = `var(${CATEGORY_COLOR_VAR[category]})`;
  return [
    `radial-gradient(90% 120% at 0% 0%,`,
    `color-mix(in oklab, ${colour} 30%, transparent) 0%,`,
    `color-mix(in oklab, ${colour} 10%, transparent) 32%,`,
    `transparent 62%)`,
  ].join(" ");
}

/** Category -> "text-*" class for its own colour, for headings on a tile. */
export const CATEGORY_TEXT_CLASS: Record<CategoryId, string> = {
  anime: "text-cat-anime",
  manga: "text-cat-manga",
  game: "text-cat-games",
  film: "text-cat-films",
  boardgame: "text-cat-board",
  tcg: "text-cat-tcg",
};
