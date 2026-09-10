import { describe, expect, it } from "vitest";
import { interactiveCardClasses } from "./interactive-card";

describe("interactiveCardClasses", () => {
  it("lifts the card on hover and on keyboard focus alike", () => {
    const classes = interactiveCardClasses("anime");

    expect(classes).toContain("hover:scale-[1.02]");
    expect(classes).toContain("focus-visible:scale-[1.02]");
  });

  it("lights the border in the category's own colour", () => {
    expect(interactiveCardClasses("anime")).toContain("hover:border-cat-anime");
    expect(interactiveCardClasses("tcg")).toContain("hover:border-cat-tcg");
  });

  it("animates the lift it applies: Tailwind 4's scale-* sets `scale`, not `transform`", () => {
    expect(interactiveCardClasses("anime")).toContain(
      "transition-[scale,border-color]",
    );
  });

  it("holds still for anyone who asked for less motion", () => {
    const classes = interactiveCardClasses("game");

    // `transform: none` cannot cancel a `scale`, so the lift is opt-in instead
    // of being switched off afterwards.
    expect(classes).toContain("motion-safe:hover:scale-[1.02]");
    expect(classes).toContain("motion-safe:focus-visible:scale-[1.02]");
    expect(classes).not.toMatch(/(^|\s)(hover|focus-visible):scale/);
  });
});
