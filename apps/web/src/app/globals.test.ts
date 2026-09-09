import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * jsdom does not apply the stylesheet, so these affordances cannot be asserted
 * by rendering a component. They are load-bearing enough to be worth guarding
 * against a silent deletion.
 */
const css = readFileSync(join(__dirname, "globals.css"), "utf8");

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
