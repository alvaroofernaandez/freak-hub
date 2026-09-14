import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * jsdom does not apply the stylesheet, so these affordances cannot be asserted
 * by rendering a component. They are load-bearing enough to be worth guarding
 * against a silent deletion.
 */
const css = readFileSync(join(__dirname, "globals.css"), "utf8");

/**
 * Removes every `@layer ... { ... }` block from `css` via brace matching,
 * leaving whatever was never inside a layer. Per CSS Cascade Layers,
 * unlayered rules always win over layered ones with the same specificity,
 * so this is how the suite tells "layered" apart from "unlayered" without a
 * real browser.
 */
function stripLayers(rawCss: string): string {
  // Comments can legitimately contain the literal text "@layer" (as this
  // very file's does, documenting why the rule is unlayered) — strip them
  // first so brace-matching only ever considers real at-rules.
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
  let result = "";
  let i = 0;
  while (i < css.length) {
    const layerStart = css.indexOf("@layer", i);
    if (layerStart === -1) {
      result += css.slice(i);
      break;
    }
    result += css.slice(i, layerStart);
    const braceOpen = css.indexOf("{", layerStart);
    let depth = 1;
    let j = braceOpen + 1;
    while (depth > 0 && j < css.length) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    i = j;
  }
  return result;
}

describe("globals.css reduced-motion cascade layering", () => {
  it("keeps the reduced-motion keyframe overrides outside any @layer, so they win over the unlayered full-motion keyframes", () => {
    const unlayered = stripLayers(css);
    const reducedMotionIndex = unlayered.indexOf(
      "prefers-reduced-motion: reduce",
    );
    expect(reducedMotionIndex).toBeGreaterThan(-1);

    const reducedMotionBlock = unlayered.slice(reducedMotionIndex);
    expect(reducedMotionBlock).toMatch(/@keyframes rise/);
    expect(reducedMotionBlock).toMatch(/@keyframes route-in/);

    const riseBlock = reducedMotionBlock.slice(
      reducedMotionBlock.indexOf("@keyframes rise"),
    );
    expect(riseBlock).toMatch(/opacity:\s*0/);
    expect(riseBlock).not.toMatch(/translate/);
    expect(riseBlock).not.toMatch(/filter/);
  });
});

describe("globals.css", () => {
  it("restores the pointer cursor Tailwind 4 removes from buttons", () => {
    expect(css).toMatch(/button:not\(:disabled\)[\s\S]*?cursor: pointer/);
  });

  it("marks disabled controls as not allowed, rather than merely faded", () => {
    expect(css).toMatch(/button:disabled[\s\S]*?cursor: not-allowed/);
  });

  it("gives every pressable element a press state", () => {
    expect(css).toMatch(
      /button:not\(:disabled\):active[\s\S]*?transform: scale/,
    );
  });

  it("drops the press animation under reduced motion", () => {
    const reducedMotion = css.slice(
      css.indexOf("prefers-reduced-motion: reduce"),
    );
    expect(reducedMotion).toMatch(/transform: none/);
  });
});

/**
 * The light theme (issue #37). `docs/design.md` fixes six light neutrals; the
 * rest are derived there too, so this suite guards both the exact documented
 * values and the presence of every derived one — a token that exists in dark
 * and not in light falls back to its dark value and paints, say, near-black
 * text on a near-white page.
 */
describe("globals.css light theme", () => {
  // Comments legitimately name the selector (this file's do, explaining why
  // the block is unlayered), so strip them before brace-matching or the
  // extraction starts inside a comment instead of at the rule.
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

  const lightBlock = (() => {
    const start = declarations.indexOf(':root[data-theme="light"]');
    if (start === -1) return "";
    const open = declarations.indexOf("{", start);
    let depth = 1;
    let i = open + 1;
    while (depth > 0 && i < declarations.length) {
      if (declarations[i] === "{") depth++;
      else if (declarations[i] === "}") depth--;
      i++;
    }
    return declarations.slice(open, i);
  })();

  it("defines the light palette behind [data-theme=light]", () => {
    expect(lightBlock).not.toBe("");
  });

  it.each([
    ["--color-ground", "oklch(0.975 0.006 272)"],
    ["--color-surface", "oklch(0.995 0.003 272)"],
    ["--color-surface-raised", "oklch(0.955 0.012 272)"],
    ["--color-border", "oklch(0.84 0.018 272)"],
    ["--color-ink", "oklch(0.22 0.02 272)"],
    ["--color-ink-muted", "oklch(0.46 0.02 272)"],
  ])("uses the documented light value for %s", (token, value) => {
    expect(lightBlock).toContain(`${token}: ${value};`);
  });

  it.each([
    "--color-ground-deep",
    "--color-border-soft",
    "--color-ink-faint",
    "--color-accent",
    "--color-accent-ink",
    "--color-cat-manga",
    "--color-cat-games",
    "--color-cat-films",
    "--color-cat-board",
    "--color-cat-tcg",
    "--color-danger",
  ])("also re-seats the derived token %s", (token) => {
    expect(lightBlock).toContain(`${token}:`);
  });

  it("flips color-scheme with the theme, so form controls and scrollbars follow", () => {
    expect(lightBlock).toContain("color-scheme: light;");
  });

  it("keeps the light palette unlayered, so it beats the @theme defaults", () => {
    expect(stripLayers(css)).toContain(':root[data-theme="light"]');
  });

  /**
   * `--ground-deep` is a recess in the page, and in the light theme a recess
   * is still light — the search field and the cover placeholder depend on it.
   * The modal scrim therefore cannot borrow it any more: 55% of a near-white
   * over a near-white page pushes nothing back. `--scrim` is its own token,
   * dark in both themes.
   */
  it("gives the modal scrim its own token instead of borrowing --ground-deep", () => {
    expect(declarations).toMatch(/--color-scrim:\s*oklch\(/);
    expect(lightBlock).not.toContain("--color-scrim:");
  });
});
