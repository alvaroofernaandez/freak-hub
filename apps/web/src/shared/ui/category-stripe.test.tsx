import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryStripe } from "./category-stripe";

const SEGMENTS_IN_ORDER = [
  { id: "anime", colorClass: "bg-cat-anime" },
  { id: "manga", colorClass: "bg-cat-manga" },
  { id: "game", colorClass: "bg-cat-games" },
  { id: "film", colorClass: "bg-cat-films" },
  { id: "boardgame", colorClass: "bg-cat-board" },
  { id: "tcg", colorClass: "bg-cat-tcg" },
] as const;

describe("CategoryStripe", () => {
  it("renders the six segments, in order, each with its category color", () => {
    render(<CategoryStripe />);

    const segments = screen.getAllByTestId("category-stripe-segment");
    expect(segments).toHaveLength(6);

    segments.forEach((segment, index) => {
      const expected = SEGMENTS_IN_ORDER[index];
      expect(segment).toHaveAttribute("data-category", expected.id);
      expect(segment).toHaveClass(expected.colorClass);
    });
  });

  it("gives every segment equal width when there is no active category", () => {
    render(<CategoryStripe />);

    for (const segment of screen.getAllByTestId("category-stripe-segment")) {
      expect(segment).toHaveClass("flex-1");
      expect(segment).not.toHaveClass("flex-[2]");
    }
  });

  it("widens only the active segment", () => {
    render(<CategoryStripe activeCategory="game" />);

    const segments = screen.getAllByTestId("category-stripe-segment");
    const active = segments.find(
      (segment) => segment.getAttribute("data-category") === "game",
    );
    const inactive = segments.filter(
      (segment) => segment.getAttribute("data-category") !== "game",
    );

    expect(active).toHaveClass("flex-[2]");
    for (const segment of inactive) {
      expect(segment).toHaveClass("flex-1");
      expect(segment).not.toHaveClass("flex-[2]");
    }
  });

  it("is aria-hidden, as it is purely decorative", () => {
    render(<CategoryStripe />);

    expect(screen.getByTestId("category-stripe")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
