import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Work } from "@/features/library/lib/work";

const open = vi.fn();
vi.mock("@/shared/ui/add-category-modal", () => ({
  useAddCategoryModal: () => ({ isOpen: false, open, close: vi.fn() }),
}));

const { LibrarySection } = await import("./library-section");

const WORKS: Work[] = [
  {
    id: "1",
    title: "Favorita",
    category: "anime",
    status: "completed",
    isFavourite: true,
  },
  {
    id: "2",
    title: "No favorita",
    category: "anime",
    status: "completed",
    isFavourite: false,
  },
];

describe("LibrarySection", () => {
  it("shows only the favourite works", () => {
    render(<LibrarySection works={WORKS} />);

    expect(screen.getByText("Favorita")).toBeInTheDocument();
    expect(screen.queryByText("No favorita")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no favourites", () => {
    render(<LibrarySection works={[WORKS[1]]} />);

    expect(screen.getByText(/sin favoritos/i)).toBeInTheDocument();
  });

  it("offers no action on a read-only profile — canAdd defaults to false", () => {
    render(<LibrarySection works={[]} />);

    expect(
      screen.queryByRole("button", { name: /añadir/i }),
    ).not.toBeInTheDocument();
  });

  it("offers to add a work, only when canAdd is true, opening the add-category picker", async () => {
    const user = userEvent.setup();
    render(<LibrarySection works={[]} canAdd />);

    const button = screen.getByRole("button", { name: /añadir/i });
    await user.click(button);

    expect(open).toHaveBeenCalled();
  });

  it("does not offer the action when there is already something to show", () => {
    render(<LibrarySection works={WORKS} canAdd />);

    expect(
      screen.queryByRole("button", { name: /añadir/i }),
    ).not.toBeInTheDocument();
  });
});
