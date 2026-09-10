/**
 * The single motion vocabulary for the app (ADR-0012). No component writes
 * its own duration, curve or variant: everything imports from here, so a
 * change in "how fast things move" happens in one place.
 */

/** Must equal `--ease-out-quint` in globals.css — tokens.test.ts checks this. */
export const EASE_OUT_QUINT: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];

/**
 * Seconds, not milliseconds: Motion's `transition.duration` takes seconds.
 * Exits read faster than enters (75% of `base`) so a dismissal never feels
 * like it is dragging its feet.
 */
/** Exits read faster than their matching enter: `enterSeconds * EXIT_RATIO`. */
export const EXIT_RATIO = 0.75;

export const DURATION = {
  fast: 0.15,
  base: 0.22,
  layout: 0.35,
  /** 75% of `base`. Components that enter on `fast` (150ms) derive their own
   * exit the same way: `DURATION.fast * EXIT_RATIO`. */
  exit: 0.22 * EXIT_RATIO,
};

/** Layout animations (the tab indicator, grid reflow) never bounce. */
export const LAYOUT_SPRING = {
  type: "spring" as const,
  duration: DURATION.layout,
  bounce: 0,
};

/**
 * A cascading list is a rhythm, not a wait: capped at 8 items so a long grid
 * does not keep the last card waiting seconds to appear.
 */
const MAX_STAGGER_INDEX = 7;

export function staggerIndex(i: number): number {
  return Math.min(i, MAX_STAGGER_INDEX);
}

/**
 * The `--i` custom property `.stagger-in` (globals.css) reads to delay a
 * cascading list item. A plain object, not a `React.CSSProperties` cast, so
 * this file stays framework-agnostic; callers cast at the call site.
 */
export function staggerStyle(i: number): { "--i": number } {
  return { "--i": staggerIndex(i) };
}

/**
 * Popovers (dropdown menu, select) scale from the Radix transform-origin var,
 * so they visibly unfold from the control that opened them.
 */
const popover = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  shown: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: -4 },
};

/** Content that swaps in place (a pending label, a filtered list item). */
const fadeSwap = {
  hidden: { opacity: 0, y: 4, filter: "blur(2px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -4, filter: "blur(2px)" },
};

export const variants = { popover, fadeSwap };
