import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MockWork } from "@/features/library/lib/mock-works";
import { LibrarySection } from "./library-section";

const WORKS: MockWork[] = [
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
});
