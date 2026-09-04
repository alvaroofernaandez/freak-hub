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

  it("applies the work's category color to the cover", () => {
    render(<WorkCard work={BASE_WORK} />);

    expect(screen.getByTestId("work-card-cover")).toHaveClass("bg-cat-anime");
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

  it("shows the rating when it is present, and hides it otherwise", () => {
    const { rerender } = render(
      <WorkCard work={{ ...BASE_WORK, rating: 9 }} />,
    );
    expect(screen.getByText("9/10")).toBeInTheDocument();

    rerender(<WorkCard work={BASE_WORK} />);
    expect(screen.queryByText(/\/10/)).not.toBeInTheDocument();
  });
});
