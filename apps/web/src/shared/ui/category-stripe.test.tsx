import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLOR_CLASS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CategoryStripe,
} from "./category-stripe";

const SEGMENTS_IN_ORDER = [
  { id: "anime", colorClass: "bg-cat-anime" },
  { id: "manga", colorClass: "bg-cat-manga" },
  { id: "game", colorClass: "bg-cat-games" },
  { id: "film", colorClass: "bg-cat-films" },
  { id: "boardgame", colorClass: "bg-cat-board" },
  { id: "tcg", colorClass: "bg-cat-tcg" },
] as const;

describe("CATEGORY_ORDER, CATEGORY_COLOR_CLASS and CATEGORY_LABELS", () => {
  it("agree on the same six categories, in the same order", () => {
    expect(CATEGORY_ORDER).toEqual(SEGMENTS_IN_ORDER.map((s) => s.id));
  });

  it("maps each category to its stripe color class", () => {
    for (const { id, colorClass } of SEGMENTS_IN_ORDER) {
      expect(CATEGORY_COLOR_CLASS[id]).toBe(colorClass);
    }
  });

  it("gives every category a non-empty Spanish label", () => {
    for (const id of CATEGORY_ORDER) {
      expect(CATEGORY_LABELS[id]).toMatch(/\S/);
    }
  });
});

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
