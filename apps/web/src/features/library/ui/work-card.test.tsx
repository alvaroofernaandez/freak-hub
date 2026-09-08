import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MockWork } from "@/features/library/lib/mock-works";
import { WorkCard } from "./work-card";

const BASE_WORK: MockWork = {
  id: "anime-fma",
  title: "Fullmetal Alchemist: Brotherhood",
  category: "anime",
  status: "completed",
  isFavourite: false,
};

describe("WorkCard", () => {
  it("links to the work's page", () => {
    render(<WorkCard work={BASE_WORK} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/obras/anime-fma",
    );
  });

  it("shows the title", () => {
    render(<WorkCard work={BASE_WORK} />);

    expect(
      screen.getByText("Fullmetal Alchemist: Brotherhood"),
    ).toBeInTheDocument();
  });

  it("uses a neutral card background with a cover placeholder, not a category-colored cover", () => {
    render(<WorkCard work={BASE_WORK} />);

    expect(screen.getByRole("link")).toHaveClass("bg-surface");
    const cover = screen.getByTestId("work-card-cover");
    expect(cover).not.toHaveClass("bg-cat-anime");
    expect(cover).toHaveTextContent("portada");
  });

  it("shows the entry's status badge", () => {
    render(<WorkCard work={{ ...BASE_WORK, status: "in_progress" }} />);

    expect(screen.getByText("En curso")).toBeInTheDocument();
  });

  it("marks favourites, and only favourites", () => {
    const { rerender } = render(
      <WorkCard work={{ ...BASE_WORK, isFavourite: true }} />,
    );
    expect(screen.getByLabelText("Favorito")).toBeInTheDocument();

    rerender(<WorkCard work={{ ...BASE_WORK, isFavourite: false }} />);
    expect(screen.queryByLabelText("Favorito")).not.toBeInTheDocument();
  });

  it("overlays the favourite marker on the cover, not the title/status area", () => {
    render(<WorkCard work={{ ...BASE_WORK, isFavourite: true }} />);

    const cover = screen.getByTestId("work-card-cover");
    const favourite = screen.getByLabelText("Favorito");
    expect(cover.parentElement).toContainElement(favourite);

    const title = screen.getByTestId("work-card-title");
    expect(title.parentElement).not.toContainElement(favourite);
  });

  it("shows the rating when it is present, and hides it otherwise", () => {
    const { rerender } = render(
      <WorkCard work={{ ...BASE_WORK, rating: 9 }} />,
    );
    expect(screen.getByText("9/10")).toBeInTheDocument();

    rerender(<WorkCard work={BASE_WORK} />);
    expect(screen.queryByText(/\/10/)).not.toBeInTheDocument();
  });
});
