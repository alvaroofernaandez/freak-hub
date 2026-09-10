import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DURATION,
  EASE_OUT_QUINT,
  EXIT_RATIO,
  LAYOUT_SPRING,
  staggerIndex,
  staggerStyle,
  variants,
} from "./tokens";

const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

describe("motion tokens", () => {
  it("matches the --ease-out-quint curve declared in globals.css", () => {
    const match = css.match(/--ease-out-quint:\s*cubic-bezier\(([^)]+)\)/);
    expect(match).not.toBeNull();
    const cssCurve = (match?.[1] ?? "")
      .split(",")
      .map((value) => Number.parseFloat(value.trim()));
    expect(EASE_OUT_QUINT).toEqual(cssCurve);
  });

  it("defines exits as 75% of their matching enter duration", () => {
    expect(DURATION.fast).toBeCloseTo(0.15);
    expect(DURATION.base).toBeCloseTo(0.22);
    expect(DURATION.layout).toBeCloseTo(0.35);
    expect(EXIT_RATIO).toBeCloseTo(0.75);
    expect(DURATION.exit).toBeCloseTo(DURATION.base * EXIT_RATIO);
    // Any enter duration can derive its own exit the same way, e.g. the
    // dialog's 150ms enter exits at ~112.5ms.
    expect(DURATION.fast * EXIT_RATIO).toBeCloseTo(0.1125);
  });

  it("defines a layout spring with no bounce, matching the 0.35s layout duration", () => {
    expect(LAYOUT_SPRING).toEqual({
      type: "spring",
      duration: DURATION.layout,
      bounce: 0,
    });
  });

  it("caps stagger delay at 8 items of 40ms each", () => {
    expect(staggerIndex(0)).toBe(0);
    expect(staggerIndex(3)).toBe(3);
    expect(staggerIndex(7)).toBe(7);
    expect(staggerIndex(20)).toBe(7);
  });

  it("exposes the stagger index as the CSS custom property globals.css reads", () => {
    expect(staggerStyle(3)).toEqual({ "--i": 3 });
    expect(staggerStyle(20)).toEqual({ "--i": 7 });
  });

  it("defines a popover preset that scales from the Radix transform origin", () => {
    expect(variants.popover.hidden).toMatchObject({
      opacity: 0,
      scale: 0.96,
      y: -4,
    });
    expect(variants.popover.shown).toMatchObject({
      opacity: 1,
      scale: 1,
      y: 0,
    });
    expect(variants.popover.exit).toMatchObject({
      opacity: 0,
      scale: 0.98,
      y: -4,
    });
  });

  it("defines a fadeSwap preset for presence swaps", () => {
    expect(variants.fadeSwap.hidden).toMatchObject({ opacity: 0, y: 4 });
    expect(variants.fadeSwap.shown).toMatchObject({ opacity: 1, y: 0 });
    expect(variants.fadeSwap.exit).toMatchObject({ opacity: 0, y: -4 });
  });
});
