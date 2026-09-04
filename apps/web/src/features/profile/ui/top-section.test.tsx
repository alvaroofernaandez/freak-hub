import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { MockWork } from "@/features/library/lib/mock-works";
import { TopSection } from "./top-section";

const WORKS: MockWork[] = [
  {
    id: "1",
    title: "Ocho",
    category: "anime",
    status: "completed",
    isFavourite: false,
    rating: 8,
  },
  {
    id: "2",
    title: "Diez",
    category: "anime",
    status: "completed",
    isFavourite: false,
    rating: 10,
  },
  {
    id: "3",
    title: "Sin valorar",
    category: "manga",
    status: "in_progress",
    isFavourite: false,
  },
  {
    id: "4",
    title: "Seis de mesa",
    category: "boardgame",
    status: "completed",
    isFavourite: false,
    rating: 6,
  },
];

describe("TopSection", () => {
  it("lists only rated works, sorted by rating descending", () => {
    render(<TopSection works={WORKS} />);

    const titles = screen
      .getAllByText(/^(Diez|Ocho|Seis de mesa)$/)
      .map((el) => el.textContent);
    expect(titles).toEqual(["Diez", "Ocho", "Seis de mesa"]);
    expect(screen.queryByText("Sin valorar")).not.toBeInTheDocument();
  });

  it("filters by category", async () => {
    const user = userEvent.setup();
    render(<TopSection works={WORKS} />);

    await user.selectOptions(screen.getByLabelText("Categoría"), "boardgame");

    expect(screen.getByText("Seis de mesa")).toBeInTheDocument();
    expect(screen.queryByText("Diez")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing is rated", () => {
    render(<TopSection works={[WORKS[2]]} />);

    expect(screen.getByText(/sin obras valoradas/i)).toBeInTheDocument();
  });
});
