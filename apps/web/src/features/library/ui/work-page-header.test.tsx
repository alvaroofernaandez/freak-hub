import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Work } from "@/features/library/lib/work";
import { WorkPageHeader } from "./work-page-header";

const BASE_WORK: Work = {
  id: "anime-fma",
  title: "Fullmetal Alchemist: Brotherhood",
  category: "anime",
  status: "completed",
  isFavourite: false,
};

const BOARDGAME_WORK: Work = {
  id: "board-wingspan",
  title: "Wingspan",
  category: "boardgame",
  status: "completed",
  isFavourite: true,
  year: 2019,
  duration: "40–70 min",
  players: "1–5 jugadores",
  publisher: "Stonemaier Games",
  source: "BoardGameGeek",
};

describe("WorkPageHeader", () => {
  it("shows how far along the work is when it has progress", () => {
    render(<WorkPageHeader work={{ ...BASE_WORK, progress: 40 }} />);

    expect(
      screen.getByRole("progressbar", { name: /progreso/i }),
    ).toHaveAttribute("aria-valuenow", "40");
  });

  it("shows no progress bar when the work has no progress recorded", () => {
    render(<WorkPageHeader work={{ ...BASE_WORK, progress: undefined }} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows a cover placeholder", () => {
    render(<WorkPageHeader work={BASE_WORK} />);

    expect(screen.getByText("portada")).toBeInTheDocument();
  });

  it("shows the work's title as the page heading", () => {
    render(<WorkPageHeader work={BASE_WORK} />);

    expect(
      screen.getByRole("heading", {
        name: "Fullmetal Alchemist: Brotherhood",
      }),
    ).toBeInTheDocument();
  });

  it("shows the category pill as an outline, not a solid fill", () => {
    render(<WorkPageHeader work={BOARDGAME_WORK} />);

    const pill = screen.getByText("Juegos de mesa");
    expect(pill).toHaveClass("border-cat-board");
    expect(pill).toHaveClass("text-cat-board");
    expect(pill).not.toHaveClass("bg-cat-board");
  });

  it("joins the category-specific metadata into one line for a boardgame", () => {
    render(<WorkPageHeader work={BOARDGAME_WORK} />);

    expect(
      screen.getByText("2019 · 40–70 min · 1–5 jugadores · Stonemaier Games"),
    ).toBeInTheDocument();
  });

  it("omits the metadata line when none of its fields are present", () => {
    render(<WorkPageHeader work={BASE_WORK} />);

    expect(
      screen.queryByTestId("work-page-header-metadata"),
    ).not.toBeInTheDocument();
  });

  it("shows the source attribution when present", () => {
    render(<WorkPageHeader work={BOARDGAME_WORK} />);

    expect(screen.getByText("Fuente: BoardGameGeek")).toBeInTheDocument();
  });

  it("omits the source attribution when absent", () => {
    render(<WorkPageHeader work={BASE_WORK} />);

    expect(screen.queryByText(/^Fuente:/)).not.toBeInTheDocument();
  });
});
