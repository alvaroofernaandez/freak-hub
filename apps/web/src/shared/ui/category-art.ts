import type { CategoryId } from "./category-stripe";

/**
 * A character standing in for each category, cut out and served from /public.
 * All six are 700px tall; the taller subjects carry transparent headroom so the
 * card scales them down to a similar visual weight.
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
 * Category -> its CSS custom property. Used to build the stage glow inline:
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
 * The stage glow: a pool of the category's light on the floor, right where the
 * character stands, as on a character select screen. It fades out before it
 * reaches the name on the left, so the name keeps its full contrast.
 *
 * It replaced a top-left corner glow that lit nothing: on the dark surface it
 * read as a smudge in an empty corner, far from both the character and the name.
 */
export function stageGlow(category: CategoryId): string {
  const colour = `var(${CATEGORY_COLOR_VAR[category]})`;
  return [
    `radial-gradient(65% 95% at 82% 100%,`,
    `color-mix(in oklab, ${colour} 38%, transparent) 0%,`,
    `color-mix(in oklab, ${colour} 12%, transparent) 45%,`,
    `transparent 78%)`,
  ].join(" ");
}

/** Category -> "text-*" class for its own colour, for the name on a card. */
export const CATEGORY_TEXT_CLASS: Record<CategoryId, string> = {
  anime: "text-cat-anime",
  manga: "text-cat-manga",
  game: "text-cat-games",
  film: "text-cat-films",
  boardgame: "text-cat-board",
  tcg: "text-cat-tcg",
};
