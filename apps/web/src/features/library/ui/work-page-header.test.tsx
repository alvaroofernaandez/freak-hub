import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LibraryItem } from "@/features/library/lib/library-item";
import { WorkPageHeader } from "./work-page-header";

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
    year: null,
    season: null,
    source: "manual",
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("WorkPageHeader", () => {
  it("draws the progress bar as a share of the total, not as the raw count", () => {
    render(<WorkPageHeader item={item({ progress: 32, progressTotal: 64 })} />);

    expect(
      screen.getByRole("progressbar", { name: /progreso/i }),
    ).toHaveAttribute("aria-valuenow", "50");
  });

  it("shows no progress bar when the catalogue gives no total to be a share of", () => {
    render(
      <WorkPageHeader item={item({ progress: 12, progressTotal: null })} />,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByTestId("work-page-header-progress")).toHaveTextContent(
      "12 episodios",
    );
  });

  it("shows no progress at all when nothing has been recorded", () => {
    render(<WorkPageHeader item={item({ progress: 0 })} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("work-page-header-progress"),
    ).not.toBeInTheDocument();
  });

  it("shows a cover placeholder", () => {
    render(<WorkPageHeader item={item()} />);

    expect(screen.getByText("portada")).toBeInTheDocument();
  });

  it("shows the work's title as the page heading", () => {
    render(<WorkPageHeader item={item()} />);

    expect(
      screen.getByRole("heading", {
        name: "Fullmetal Alchemist: Brotherhood",
      }),
    ).toBeInTheDocument();
  });

  it("shows the category pill as an outline, not a solid fill", () => {
    render(<WorkPageHeader item={item({ category: "boardgame" })} />);

    const pill = screen.getByText("Juegos de mesa");
    expect(pill).toHaveClass("border-cat-board");
    expect(pill).toHaveClass("text-cat-board");
    expect(pill).not.toHaveClass("bg-cat-board");
  });

  it("joins the year, the episode count and the season into one line for an anime", () => {
    render(
      <WorkPageHeader
        item={item({ year: 2009, progressTotal: 64, season: "2009-spring" })}
      />,
    );

    expect(screen.getByTestId("work-page-header-metadata")).toHaveTextContent(
      "2009 · 64 episodios · Primavera",
    );
  });

  it("shows a season the catalogue labelled some other way exactly as it arrived", () => {
    render(<WorkPageHeader item={item({ season: "temporada especial" })} />);

    expect(screen.getByTestId("work-page-header-metadata")).toHaveTextContent(
      "temporada especial",
    );
  });

  it("keeps the episode count and season out of a category that has neither", () => {
    render(
      <WorkPageHeader
        item={item({
          category: "game",
          year: 2019,
          progressTotal: 64,
          season: "2009-spring",
        })}
      />,
    );

    expect(screen.getByTestId("work-page-header-metadata")).toHaveTextContent(
      "2019",
    );
    expect(
      screen.getByTestId("work-page-header-metadata"),
    ).not.toHaveTextContent("episodios");
  });

  it("omits the metadata line when the contract knows none of its fields", () => {
    render(<WorkPageHeader item={item()} />);

    expect(
      screen.queryByTestId("work-page-header-metadata"),
    ).not.toBeInTheDocument();
  });

  it("credits the catalogue the work was imported from", () => {
    render(<WorkPageHeader item={item({ source: "anilist" })} />);

    expect(screen.getByText("Fuente: AniList")).toBeInTheDocument();
  });

  it("credits nobody for a work somebody typed in by hand", () => {
    render(<WorkPageHeader item={item({ source: "manual" })} />);

    expect(screen.queryByText(/^Fuente:/)).not.toBeInTheDocument();
  });
});
