import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LibraryItem } from "@/features/library/lib/library-item";

const open = vi.fn();
vi.mock("@/shared/ui/add-category-modal", () => ({
  useAddCategoryModal: () => ({ isOpen: false, open, close: vi.fn() }),
}));

const { LibrarySection } = await import("./library-section");

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
  item({ id: "1", title: "Favorita", isFavourite: true }),
  item({ id: "2", title: "No favorita", isFavourite: false }),
];

describe("LibrarySection", () => {
  it("shows only the favourite entries", () => {
    render(<LibrarySection items={ITEMS} />);

    expect(screen.getByText("Favorita")).toBeInTheDocument();
    expect(screen.queryByText("No favorita")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no favourites", () => {
    render(<LibrarySection items={[ITEMS[1]]} />);

    expect(screen.getByText(/sin favoritos/i)).toBeInTheDocument();
  });

  it("offers no action on a read-only profile — canAdd defaults to false", () => {
    render(<LibrarySection items={[]} />);

    expect(
      screen.queryByRole("button", { name: /añadir/i }),
    ).not.toBeInTheDocument();
  });

  it("offers to add a work, only when canAdd is true, opening the add-category picker", async () => {
    const user = userEvent.setup();
    render(<LibrarySection items={[]} canAdd />);

    const button = screen.getByRole("button", { name: /añadir/i });
    await user.click(button);

    expect(open).toHaveBeenCalled();
  });

  it("does not offer the action when there is already something to show", () => {
    render(<LibrarySection items={ITEMS} canAdd />);

    expect(
      screen.queryByRole("button", { name: /añadir/i }),
    ).not.toBeInTheDocument();
  });
});
