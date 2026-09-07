import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ActiveCategoryProvider,
  CategoryStripeHost,
  SetActiveCategory,
} from "./active-category";

describe("ActiveCategoryProvider / CategoryStripeHost / SetActiveCategory", () => {
  it("gives every segment equal width when nothing set an active category", () => {
    render(
      <ActiveCategoryProvider>
        <CategoryStripeHost />
      </ActiveCategoryProvider>,
    );

    for (const segment of screen.getAllByTestId("category-stripe-segment")) {
      expect(segment).toHaveClass("flex-1");
    }
  });

  it("widens the segment declared by a nested SetActiveCategory", () => {
    render(
      <ActiveCategoryProvider>
        <SetActiveCategory category="game" />
        <CategoryStripeHost />
      </ActiveCategoryProvider>,
    );

    const segments = screen.getAllByTestId("category-stripe-segment");
    const active = segments.find(
      (segment) => segment.getAttribute("data-category") === "game",
    );
    expect(active).toHaveClass("flex-[2]");
  });

  it("clears the active category once SetActiveCategory unmounts", () => {
    const { rerender } = render(
      <ActiveCategoryProvider>
        <SetActiveCategory category="game" />
        <CategoryStripeHost />
      </ActiveCategoryProvider>,
    );

    rerender(
      <ActiveCategoryProvider>
        <CategoryStripeHost />
      </ActiveCategoryProvider>,
    );

    for (const segment of screen.getAllByTestId("category-stripe-segment")) {
      expect(segment).toHaveClass("flex-1");
    }
  });

  it("does not throw when SetActiveCategory renders without a provider", () => {
    expect(() => render(<SetActiveCategory category="anime" />)).not.toThrow();
  });
});
