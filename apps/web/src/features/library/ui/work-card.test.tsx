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
    expect(screen.getByText("9/10")).toBeInTheDocument();

    rerender(<WorkCard item={item({ rating: null })} />);
    expect(screen.queryByText(/\/10/)).not.toBeInTheDocument();
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
