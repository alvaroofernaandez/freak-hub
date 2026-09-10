import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CSSProperties } from "react";
import { describe, expect, it, vi } from "vitest";
import { CategoryCard } from "./category-card";
import { CATEGORY_ORDER } from "./category-stripe";

describe("CategoryCard", () => {
  describe("as a link, in the library lobby", () => {
    it("links to the given href", () => {
      render(
        <CategoryCard category="anime" count={3} href="/biblioteca/anime" />,
      );

      expect(screen.getByRole("link")).toHaveAttribute(
        "href",
        "/biblioteca/anime",
      );
    });

    it("accepts a className and style, for callers that stagger a grid of them in", () => {
      render(
        <CategoryCard
          category="anime"
          count={3}
          href="/biblioteca/anime"
          className="stagger-in"
          style={{ "--i": 2 } as CSSProperties}
        />,
      );

      const link = screen.getByRole("link");
      expect(link).toHaveClass("stagger-in");
      expect(link.style.getPropertyValue("--i")).toBe("2");
    });

    it("shows the count as a bare figure, without repeating the word", () => {
      render(
        <CategoryCard category="anime" count={12} href="/biblioteca/anime" />,
      );

      const count = screen.getByTestId("category-card-count");
      expect(count).toHaveTextContent("12");
      expect(count.textContent).not.toMatch(/obra/i);
    });

    it("rolls the count via AnimatedNumber instead of a static digit", () => {
      // The chip itself stays `aria-hidden` (the accessible "N obras" text
      // lives next to the name instead), so AnimatedNumber's own internal
      // sr-only span is harmlessly hidden along with it — this only checks
      // that the figure is a real AnimatedNumber, for the roll.
      render(
        <CategoryCard category="anime" count={12} href="/biblioteca/anime" />,
      );

      const count = screen.getByTestId("category-card-count");
      expect(
        count.querySelector('[aria-hidden="true"].tabular-nums'),
      ).not.toBeNull();
    });

    it("still tells assistive tech what the figure counts", () => {
      render(
        <CategoryCard category="anime" count={12} href="/biblioteca/anime" />,
      );

      expect(
        screen.getByRole("link", { name: /12 obras/i }),
      ).toBeInTheDocument();
    });

    it("pluralizes the count for the screen reader", () => {
      const { rerender } = render(
        <CategoryCard category="anime" count={0} href="/biblioteca/anime" />,
      );
      expect(screen.getByText("0 obras")).toBeInTheDocument();

      rerender(
        <CategoryCard category="anime" count={1} href="/biblioteca/anime" />,
      );
      expect(screen.getByText("1 obra")).toBeInTheDocument();

      rerender(
        <CategoryCard category="anime" count={5} href="/biblioteca/anime" />,
      );
      expect(screen.getByText("5 obras")).toBeInTheDocument();
    });
  });

  describe("as a button, in the add picker", () => {
    it("is a button named after the category, and reports the choice", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <CategoryCard category="tcg" size="compact" onSelect={onSelect} />,
      );

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "TCG" }));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("shows no count when there is nothing to count", () => {
      render(
        <CategoryCard category="tcg" size="compact" onSelect={() => {}} />,
      );

      expect(
        screen.queryByTestId("category-card-count"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/obra/i)).not.toBeInTheDocument();
    });

    it("marks itself while the choice is being confirmed", () => {
      const { rerender } = render(
        <CategoryCard category="tcg" size="compact" onSelect={() => {}} />,
      );
      expect(screen.getByRole("button")).not.toHaveAttribute("data-selected");

      rerender(
        <CategoryCard
          category="tcg"
          size="compact"
          onSelect={() => {}}
          selected
        />,
      );
      expect(screen.getByRole("button")).toHaveAttribute("data-selected");
    });
  });

  describe("the roster look, whichever element it renders", () => {
    it("lights the character from behind, in the category's colour", () => {
      render(
        <CategoryCard category="anime" count={3} href="/biblioteca/anime" />,
      );

      const glow = screen.getByTestId("category-card-glow");
      expect(glow).toHaveAttribute("aria-hidden", "true");

      const style = glow.getAttribute("style") ?? "";
      // A soft radial falloff, not a hard-edged block.
      expect(style).toContain("radial-gradient");
      expect(style).toContain("--color-cat-anime");
      // Anchored on the bottom edge, under the character, not in the empty
      // top-left corner where it used to read as a smudge.
      expect(style).toMatch(/at \d+% 100%/);
    });

    it("names the category in its own colour", () => {
      render(
        <CategoryCard category="anime" count={3} href="/biblioteca/anime" />,
      );

      expect(screen.getByTestId("category-card-name")).toHaveClass(
        "text-cat-anime",
      );
    });

    it("shows the category's character, hidden from assistive tech", () => {
      render(
        <CategoryCard category="anime" count={3} href="/biblioteca/anime" />,
      );

      const art = screen.getByTestId("category-card-art");
      expect(art).toHaveAttribute("aria-hidden", "true");
      // next/image rewrites the src, so assert on the source we asked for.
      expect(art).toHaveAttribute("data-art", "/char-anime-ed.webp");
      expect(art.querySelector("img")).not.toBeNull();
    });

    it("gives every one of the six categories its own character, in both sizes", () => {
      for (const category of CATEGORY_ORDER) {
        for (const size of ["roster", "compact"] as const) {
          const { unmount } = render(
            <CategoryCard
              category={category}
              size={size}
              onSelect={() => {}}
            />,
          );
          expect(screen.getByTestId("category-card-art")).toBeInTheDocument();
          unmount();
        }
      }
    });

    it("keeps the card itself neutral: the colour lives on the glow and the name", () => {
      render(<CategoryCard category="tcg" count={0} href="/biblioteca/tcg" />);

      const card = screen.getByTestId("category-card");
      expect(card).toHaveClass("bg-surface");
      expect(card).not.toHaveClass("bg-cat-tcg");
    });
  });
});
