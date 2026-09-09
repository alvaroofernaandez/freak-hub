import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER } from "@/shared/ui/category-stripe";
import { CategoryTile } from "./category-tile";

describe("CategoryTile", () => {
  it("shows the count as a bare figure, without repeating the word", () => {
    render(
      <CategoryTile category="anime" count={12} href="/biblioteca/anime" />,
    );

    const count = screen.getByTestId("category-tile-count");
    expect(count).toHaveTextContent("12");
    expect(count.textContent).not.toMatch(/obra/i);
  });

  it("still tells assistive tech what the figure counts", () => {
    render(
      <CategoryTile category="anime" count={12} href="/biblioteca/anime" />,
    );

    expect(screen.getByRole("link", { name: /12 obras/i })).toBeInTheDocument();
  });

  it("says one obra in the singular, for the screen reader", () => {
    render(
      <CategoryTile category="anime" count={1} href="/biblioteca/anime" />,
    );

    expect(screen.getByRole("link", { name: /1 obra$/i })).toBeInTheDocument();
  });

  it("lights the top-left corner in the category's colour", () => {
    render(
      <CategoryTile category="anime" count={3} href="/biblioteca/anime" />,
    );

    const glow = screen.getByTestId("category-tile-glow");
    expect(glow).toHaveAttribute("aria-hidden", "true");
    // A soft radial falloff, not a hard-edged block in the corner.
    expect(glow.getAttribute("style")).toContain("radial-gradient");
    expect(glow.getAttribute("style")).toContain("--color-cat-anime");
  });

  it("lights the corner even for a category with no artwork", () => {
    render(<CategoryTile category="tcg" count={0} href="/biblioteca/tcg" />);

    expect(
      screen.getByTestId("category-tile-glow").getAttribute("style"),
    ).toContain("--color-cat-tcg");
  });

  it("names the category in its own colour", () => {
    render(
      <CategoryTile category="anime" count={3} href="/biblioteca/anime" />,
    );

    expect(screen.getByTestId("category-tile-name")).toHaveClass(
      "text-cat-anime",
    );
  });

  it("shows the category's character, hidden from assistive tech", () => {
    render(
      <CategoryTile category="anime" count={3} href="/biblioteca/anime" />,
    );

    const art = screen.getByTestId("category-tile-art");
    expect(art).toHaveAttribute("aria-hidden", "true");
    // next/image rewrites the src, so assert on the source we asked for.
    expect(art).toHaveAttribute("data-art", "/char-anime-ed.webp");
    expect(art.querySelector("img")).not.toBeNull();
  });

  it("gives every one of the six categories its own character", () => {
    for (const category of CATEGORY_ORDER) {
      const { unmount } = render(
        <CategoryTile category={category} count={0} href="/biblioteca" />,
      );
      expect(screen.getByTestId("category-tile-art")).toBeInTheDocument();
      unmount();
    }
  });

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

  it("carries the category colour on the glow and the name, never on the card itself", () => {
    render(<CategoryTile category="tcg" count={0} href="/biblioteca/tcg" />);

    expect(
      screen.getByTestId("category-tile-glow").getAttribute("style"),
    ).toContain("--color-cat-tcg");
    expect(screen.getByTestId("category-tile-name")).toHaveClass(
      "text-cat-tcg",
    );
    expect(screen.getByTestId("category-tile")).not.toHaveClass("bg-cat-tcg");
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
