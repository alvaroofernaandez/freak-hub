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
