import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Work } from "@/features/library/lib/work";
import { CategoryWorksBrowser } from "./category-works-browser";

const WORKS: Work[] = [
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
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    for (const work of WORKS) {
      expect(screen.getByText(work.title)).toBeInTheDocument();
    }
  });

  it("renders the six status filters plus favourite and owned as pressable chips", () => {
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    const expectedChips = [
      "Wishlist",
      "Pendiente",
      "En curso",
      "Terminado",
      "Abandonado",
      "En pausa",
      "Favoritos",
      "En propiedad",
    ];

    for (const name of expectedChips) {
      const chip = screen.getByRole("button", { name });
      expect(chip).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("filters by status when a status chip is pressed", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    const chip = screen.getByRole("button", { name: "En curso" });
    await user.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("En curso, no favorita")).toBeInTheDocument();
    expect(screen.queryByText("Terminada y favorita")).not.toBeInTheDocument();
    expect(screen.queryByText("Wishlist, no tenida")).not.toBeInTheDocument();
  });

  it("un-presses a status chip clicked twice, showing every status again", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    const chip = screen.getByRole("button", { name: "En curso" });
    await user.click(chip);
    await user.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "false");
    for (const work of WORKS) {
      expect(screen.getByText(work.title)).toBeInTheDocument();
    }
  });

  it("pressing one status chip releases the previously pressed one", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    const inProgress = screen.getByRole("button", { name: "En curso" });
    const wishlist = screen.getByRole("button", { name: "Wishlist" });

    await user.click(inProgress);
    await user.click(wishlist);

    expect(inProgress).toHaveAttribute("aria-pressed", "false");
    expect(wishlist).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Wishlist, no tenida")).toBeInTheDocument();
  });

  it("filters by favourite only when the favourite chip is pressed", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    const chip = screen.getByRole("button", { name: "Favoritos" });
    await user.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Terminada y favorita")).toBeInTheDocument();
    expect(screen.queryByText("En curso, no favorita")).not.toBeInTheDocument();
  });

  it("filters by owned only when the owned chip is pressed", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    const chip = screen.getByRole("button", { name: "En propiedad" });
    await user.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Terminada y favorita")).toBeInTheDocument();
    expect(screen.getByText("En curso, no favorita")).toBeInTheDocument();
    expect(screen.queryByText("Wishlist, no tenida")).not.toBeInTheDocument();
  });

  it("shows an empty state when no work matches the filters", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    await user.click(screen.getByRole("button", { name: "Abandonado" }));

    expect(
      screen.getByText(/no hay obras con estos filtros/i),
    ).toBeInTheDocument();
  });

  it("filters by a text search matching the title", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    const search = screen.getByRole("searchbox", { name: /buscar/i });
    await user.type(search, "wishlist");

    expect(screen.getByText("Wishlist, no tenida")).toBeInTheDocument();
    expect(screen.queryByText("Terminada y favorita")).not.toBeInTheDocument();
    expect(screen.queryByText("En curso, no favorita")).not.toBeInTheDocument();
  });

  it("search is case-insensitive", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    const search = screen.getByRole("searchbox", { name: /buscar/i });
    await user.type(search, "TERMINADA");

    expect(screen.getByText("Terminada y favorita")).toBeInTheDocument();
    expect(screen.queryByText("En curso, no favorita")).not.toBeInTheDocument();
  });

  it("offers a sort selector defaulting to Recientes", () => {
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    // A Radix trigger shows the label, not the underlying value.
    const sort = screen.getByRole("combobox", { name: /ordenar/i });
    expect(sort).toHaveTextContent("Recientes");
  });

  it("sorts alphabetically by title when Alfabético is selected", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    await user.click(screen.getByRole("combobox", { name: /ordenar/i }));
    await user.click(await screen.findByRole("option", { name: "Alfabético" }));

    const titles = screen
      .getAllByTestId("work-card-title")
      .map((title) => title.textContent);
    expect(titles).toEqual([
      "En curso, no favorita",
      "Terminada y favorita",
      "Wishlist, no tenida",
    ]);
  });

  it("sorts by rating, highest first, when Valoración is selected", async () => {
    const user = userEvent.setup();
    const rated: Work[] = [
      { ...WORKS[0], id: "a", title: "Ocho", rating: 8 },
      { ...WORKS[0], id: "b", title: "Diez", rating: 10 },
      { ...WORKS[0], id: "c", title: "Sin nota", rating: undefined },
    ];
    render(<CategoryWorksBrowser works={rated} category="anime" />);

    await user.click(screen.getByRole("combobox", { name: /ordenar/i }));
    await user.click(await screen.findByRole("option", { name: "Valoración" }));

    const titles = screen
      .getAllByTestId("work-card-title")
      .map((title) => title.textContent);
    expect(titles).toEqual(["Diez", "Ocho", "Sin nota"]);
  });

  it("renders works in a six-column grid on desktop", () => {
    render(<CategoryWorksBrowser works={WORKS} category="anime" />);

    expect(screen.getByTestId("category-works-grid")).toHaveClass(
      "lg:grid-cols-6",
    );
  });

  it("shows an empty state instead of the filter bar when the category has no works at all", () => {
    render(<CategoryWorksBrowser works={[]} category="anime" />);

    expect(
      screen.getByText(/aún no has añadido ninguna obra/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: /buscar/i }),
    ).not.toBeInTheDocument();
  });

  it("links the empty state's action to the category's add-search page", () => {
    render(<CategoryWorksBrowser works={[]} category="tcg" />);

    expect(
      screen.getByRole("link", { name: /añadir una obra/i }),
    ).toHaveAttribute("href", "/anadir/tcg");
  });
});
