import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LibraryItem } from "@/features/library/lib/library-item";
import { EntrySummary } from "./entry-summary";

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "entry-fma",
    workId: "work-fma",
    title: "Fullmetal Alchemist: Brotherhood",
    category: "anime",
    status: "in_progress",
    progress: 0,
    progressTotal: null,
    rating: null,
    isFavourite: false,
    owned: false,
    note: null,
    year: null,
    season: null,
    source: "anilist",
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("EntrySummary", () => {
  it("says the status with an icon and a word, never with colour", () => {
    render(<EntrySummary item={item({ status: "on_hold" })} />);

    expect(screen.getByText("En pausa")).toBeInTheDocument();
  });

  it("shows the progress in the category's own unit", () => {
    render(<EntrySummary item={item({ progress: 12, progressTotal: 64 })} />);

    expect(screen.getByTestId("entry-summary-progress")).toHaveTextContent(
      "12 / 64 episodios",
    );
    expect(
      screen.getByRole("progressbar", { name: /progreso/i }),
    ).toHaveAttribute("aria-valuenow", "19");
  });

  it("says nothing has been started rather than printing a zero", () => {
    render(<EntrySummary item={item({ progress: 0 })} />);

    expect(screen.getByTestId("entry-summary-progress")).toHaveTextContent(
      "Sin empezar",
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows the rating, and says so plainly when there is none", () => {
    const { rerender } = render(<EntrySummary item={item({ rating: 7 })} />);
    expect(screen.getByTestId("entry-summary-rating")).toHaveTextContent(
      "7/10",
    );

    rerender(<EntrySummary item={item({ rating: null })} />);
    expect(screen.getByTestId("entry-summary-rating")).toHaveTextContent(
      "Sin valorar",
    );
  });

  it("marks a favourite, and a copy the member owns", () => {
    render(<EntrySummary item={item({ isFavourite: true, owned: true })} />);

    expect(screen.getByText("Favorito")).toBeInTheDocument();
    expect(screen.getByText("En propiedad")).toBeInTheDocument();
  });

  it("leaves the marks out entirely when neither applies", () => {
    render(<EntrySummary item={item({ isFavourite: false, owned: false })} />);

    expect(screen.queryByText("Favorito")).not.toBeInTheDocument();
    expect(screen.queryByText("En propiedad")).not.toBeInTheDocument();
  });

  it("shows the dates it has, and omits the ones it does not", () => {
    render(
      <EntrySummary
        item={item({ startedAt: "2026-01-15T00:00:00.000Z", finishedAt: null })}
      />,
    );

    expect(screen.getByText("Fecha de inicio")).toBeInTheDocument();
    expect(screen.queryByText("Fecha de fin")).not.toBeInTheDocument();
  });

  it("warns that a note is public to the whole group, per ADR-0005", () => {
    render(
      <EntrySummary item={item({ note: "Uno de los mejores finales." })} />,
    );

    expect(screen.getByText("Uno de los mejores finales.")).toBeInTheDocument();
    expect(screen.getByText(/pública para el grupo/i)).toBeInTheDocument();
  });

  it("omits the note block when there is no note", () => {
    render(<EntrySummary item={item({ note: null })} />);

    expect(
      screen.queryByText(/pública para el grupo/i),
    ).not.toBeInTheDocument();
  });
});
