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

  it("holds still for anyone who asked for less motion", () => {
    expect(interactiveCardClasses("game")).toContain(
      "motion-reduce:transform-none",
    );
  });
});
