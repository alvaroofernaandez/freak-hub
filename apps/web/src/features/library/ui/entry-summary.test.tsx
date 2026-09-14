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

  it("renders nothing at all when there is neither a date nor a note, rather than an empty rule", () => {
    const { container } = render(
      <EntrySummary
        item={item({ startedAt: null, finishedAt: null, note: null })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("leaves the fields that became controls to EntryEditor, so neither shows them twice", () => {
    render(
      <EntrySummary
        item={item({
          status: "on_hold",
          rating: 7,
          progress: 12,
          progressTotal: 64,
          isFavourite: true,
          owned: true,
          note: "Una nota.",
        })}
      />,
    );

    expect(screen.queryByText("En pausa")).not.toBeInTheDocument();
    expect(screen.queryByText("7/10")).not.toBeInTheDocument();
    expect(screen.queryByText(/episodios/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Favorito")).not.toBeInTheDocument();
    expect(screen.queryByText("En propiedad")).not.toBeInTheDocument();
  });
});
