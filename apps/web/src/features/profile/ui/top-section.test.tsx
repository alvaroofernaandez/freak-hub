import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { LibraryItem } from "@/features/library/lib/library-item";
import { TopSection } from "./top-section";

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "entry-1",
    workId: "work-1",
    title: "Una obra",
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
    source: "anilist",
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const ITEMS: LibraryItem[] = [
  item({ id: "1", title: "Ocho", rating: 8 }),
  item({ id: "2", title: "Diez", rating: 10 }),
  item({
    id: "3",
    title: "Sin valorar",
    category: "manga",
    status: "in_progress",
  }),
  item({ id: "4", title: "Seis de mesa", category: "boardgame", rating: 6 }),
];

describe("TopSection", () => {
  it("lists only rated entries, sorted by rating descending", () => {
    render(<TopSection items={ITEMS} />);

    const titles = screen
      .getAllByText(/^(Diez|Ocho|Seis de mesa)$/)
      .map((el) => el.textContent);
    expect(titles).toEqual(["Diez", "Ocho", "Seis de mesa"]);
    expect(screen.queryByText("Sin valorar")).not.toBeInTheDocument();
  });

  it("filters by category", async () => {
    const user = userEvent.setup();
    render(<TopSection items={ITEMS} />);

    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(
      await screen.findByRole("option", { name: "Juegos de mesa" }),
    );

    expect(screen.getByText("Seis de mesa")).toBeInTheDocument();
    expect(screen.queryByText("Diez")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing is rated", () => {
    render(<TopSection items={[ITEMS[2]]} />);

    expect(screen.getByText(/sin obras valoradas/i)).toBeInTheDocument();
  });
});
