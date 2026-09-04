import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { MockWork } from "@/features/library/lib/mock-works";
import { CategoryWorksBrowser } from "./category-works-browser";

const WORKS: MockWork[] = [
  {
    id: "1",
    title: "Terminada y favorita",
    category: "anime",
    status: "completed",
    isFavourite: true,
    owned: true,
  },
  {
    id: "2",
    title: "En curso, no favorita",
    category: "anime",
    status: "in_progress",
    isFavourite: false,
    owned: true,
  },
  {
    id: "3",
    title: "Wishlist, no tenida",
    category: "anime",
    status: "wishlist",
    isFavourite: false,
    owned: false,
  },
];

describe("CategoryWorksBrowser", () => {
  it("renders every work by default", () => {
    render(<CategoryWorksBrowser works={WORKS} />);

    for (const work of WORKS) {
      expect(screen.getByText(work.title)).toBeInTheDocument();
    }
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} />);

    await user.selectOptions(screen.getByLabelText("Estado"), "in_progress");

    expect(screen.getByText("En curso, no favorita")).toBeInTheDocument();
    expect(screen.queryByText("Terminada y favorita")).not.toBeInTheDocument();
    expect(screen.queryByText("Wishlist, no tenida")).not.toBeInTheDocument();
  });

  it("filters by favourite only", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} />);

    await user.click(screen.getByLabelText("Solo favoritos"));

    expect(screen.getByText("Terminada y favorita")).toBeInTheDocument();
    expect(screen.queryByText("En curso, no favorita")).not.toBeInTheDocument();
  });

  it("filters by owned only", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} />);

    await user.click(screen.getByLabelText("Solo que tengo"));

    expect(screen.getByText("Terminada y favorita")).toBeInTheDocument();
    expect(screen.getByText("En curso, no favorita")).toBeInTheDocument();
    expect(screen.queryByText("Wishlist, no tenida")).not.toBeInTheDocument();
  });

  it("shows an empty state when no work matches the filters", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} />);

    await user.selectOptions(screen.getByLabelText("Estado"), "dropped");

    expect(
      screen.getByText(/no hay obras con estos filtros/i),
    ).toBeInTheDocument();
  });
});
