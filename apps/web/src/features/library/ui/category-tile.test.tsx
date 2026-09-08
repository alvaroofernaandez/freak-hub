import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryTile } from "./category-tile";

describe("CategoryTile", () => {
  it("links to the given href", () => {
    render(
      <CategoryTile category="anime" count={3} href="/biblioteca/anime" />,
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/biblioteca/anime",
    );
  });

  it("shows the category's Spanish label", () => {
    render(
      <CategoryTile
        category="boardgame"
        count={2}
        href="/biblioteca/boardgame"
      />,
    );

    expect(screen.getByText("Juegos de mesa")).toBeInTheDocument();
  });

  it("keeps the card itself neutral, not tinted by the category color", () => {
    render(<CategoryTile category="tcg" count={0} href="/biblioteca/tcg" />);

    expect(screen.getByTestId("category-tile")).not.toHaveClass("bg-cat-tcg");
    expect(screen.getByTestId("category-tile")).toHaveClass("bg-surface");
  });

  it("carries the category color on the icon square, not the card", () => {
    render(<CategoryTile category="tcg" count={0} href="/biblioteca/tcg" />);

    expect(screen.getByTestId("category-tile-icon")).toHaveClass("bg-cat-tcg");
  });

  it("pluralizes the count correctly", () => {
    const { rerender } = render(
      <CategoryTile category="anime" count={0} href="/biblioteca/anime" />,
    );
    expect(screen.getByText("0 obras")).toBeInTheDocument();

    rerender(
      <CategoryTile category="anime" count={1} href="/biblioteca/anime" />,
    );
    expect(screen.getByText("1 obra")).toBeInTheDocument();

    rerender(
      <CategoryTile category="anime" count={5} href="/biblioteca/anime" />,
    );
    expect(screen.getByText("5 obras")).toBeInTheDocument();
  });
});
