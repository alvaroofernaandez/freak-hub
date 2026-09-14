import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LibraryItem } from "@/features/library/lib/library-item";
import { WorkCard } from "./work-card";

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "entry-fma",
    workId: "work-fma",
    title: "Fullmetal Alchemist: Brotherhood",
    category: "anime",
    status: "completed",
    progress: 0,
    progressTotal: null,
    rating: null,
    isFavourite: false,
    owned: false,
    note: null,
    year: 2009,
    season: null,
    source: "anilist",
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("WorkCard", () => {
  it("links with the entry's id, which is what the work page reads", () => {
    render(<WorkCard item={item()} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/obras/entry-fma",
    );
  });

  it("shows the title", () => {
    render(<WorkCard item={item()} />);

    expect(
      screen.getByText("Fullmetal Alchemist: Brotherhood"),
    ).toBeInTheDocument();
  });

  it("uses a neutral card background with a cover placeholder, not a category-colored cover", () => {
    render(<WorkCard item={item()} />);

    expect(screen.getByRole("link")).toHaveClass("bg-surface");
    const cover = screen.getByTestId("work-card-cover");
    expect(cover).not.toHaveClass("bg-cat-anime");
    expect(cover).toHaveTextContent("portada");
  });

  it("shows the entry's status badge", () => {
    render(<WorkCard item={item({ status: "in_progress" })} />);

    expect(screen.getByText("En curso")).toBeInTheDocument();
  });

  it("marks favourites, and only favourites", () => {
    const { rerender } = render(
      <WorkCard item={item({ isFavourite: true })} />,
    );
    expect(screen.getByLabelText("Favorito")).toBeInTheDocument();

    rerender(<WorkCard item={item({ isFavourite: false })} />);
    expect(screen.queryByLabelText("Favorito")).not.toBeInTheDocument();
  });

  it("overlays the favourite marker on the cover, not the title/status area", () => {
    render(<WorkCard item={item({ isFavourite: true })} />);

    const cover = screen.getByTestId("work-card-cover");
    const favourite = screen.getByLabelText("Favorito");
    expect(cover.parentElement).toContainElement(favourite);

    const title = screen.getByTestId("work-card-title");
    expect(title.parentElement).not.toContainElement(favourite);
  });

  it("shows the rating when it is present, and hides it otherwise", () => {
    const { rerender } = render(<WorkCard item={item({ rating: 9 })} />);
    expect(screen.getByTestId("work-card-rating")).toHaveTextContent(
      "Valoración 9/10",
    );

    rerender(<WorkCard item={item({ rating: null })} />);
    expect(screen.queryByTestId("work-card-rating")).not.toBeInTheDocument();
  });

  /*
   * Issue #76: with `flex items-center justify-between`, a status and a rating
   * that together exceed the card stop being separated and read as one run —
   * measured at 1440px, `Abandonado` + `10/10` overflowed the 122px row by
   * 35px and the card itself by 23px.
   *
   * jsdom loads no stylesheet, so it cannot measure that (the same limit
   * `app/source-scan.ts` documents for colour tokens). What it CAN pin is the
   * structure that makes the collision impossible: a line each, in one column,
   * every one of them saying what it is. The geometry itself is a CSS
   * guarantee — `flex-col` with no `justify-between` — verified in a real
   * browser at 390 / 1024 / 1440px, and asserted below only as the class
   * contract those measurements depend on.
   */
  it("gives the status and the rating a line each, so they can never share a row", () => {
    render(<WorkCard item={item({ status: "dropped", rating: 10 })} />);

    const meta = screen.getByTestId("work-card-meta");
    expect(meta).toContainElement(screen.getByTestId("status-badge"));
    expect(meta).toContainElement(screen.getByTestId("work-card-rating"));
    expect([...meta.children].map((line) => line.textContent)).toEqual([
      "Abandonado",
      "Valoración 10/10",
    ]);
  });

  it("stacks the meta lines instead of pushing them to opposite edges", () => {
    render(<WorkCard item={item({ status: "dropped", rating: 10 })} />);

    const meta = screen.getByTestId("work-card-meta");
    expect(meta).toHaveClass("flex-col");
    expect(meta.className).not.toMatch(/justify-between/);
  });

  it("keeps a long title from stretching the card past its neighbours", () => {
    render(
      <WorkCard
        item={item({ title: "Ghost in the Shell: Stand Alone Complex" })}
      />,
    );

    const title = screen.getByTestId("work-card-title");
    // Clamped AND reserved: the pair is what keeps every card's status line at
    // the same height, whether its title took one line or two.
    expect(title).toHaveClass("line-clamp-2", "min-h-[2lh]");
    expect(title).toHaveAttribute(
      "title",
      "Ghost in the Shell: Stand Alone Complex",
    );
  });

  it("shows how far along the entry is, in the category's own unit", () => {
    render(<WorkCard item={item({ progress: 12, progressTotal: 64 })} />);

    expect(screen.getByTestId("work-card-progress")).toHaveTextContent(
      "12 / 64 episodios",
    );
  });

  it("says nothing about progress when nothing has been recorded", () => {
    render(<WorkCard item={item({ progress: 0 })} />);

    expect(screen.queryByTestId("work-card-progress")).not.toBeInTheDocument();
  });
});
