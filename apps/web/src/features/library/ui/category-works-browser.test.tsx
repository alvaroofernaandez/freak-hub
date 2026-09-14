import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { LibraryItem } from "@/features/library/lib/library-item";
import { CategoryWorksBrowser } from "./category-works-browser";

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
  item({
    id: "1",
    title: "Terminada y favorita",
    status: "completed",
    isFavourite: true,
    owned: true,
  }),
  item({
    id: "2",
    title: "En curso, no favorita",
    status: "in_progress",
    owned: true,
  }),
  item({ id: "3", title: "Wishlist, no tenida", status: "wishlist" }),
];

describe("CategoryWorksBrowser", () => {
  it("renders every entry by default", () => {
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    for (const entry of ITEMS) {
      expect(screen.getByText(entry.title)).toBeInTheDocument();
    }
  });

  it("renders the six status filters plus favourite and owned as pressable chips", () => {
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

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
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    const chip = screen.getByRole("button", { name: "En curso" });
    await user.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("En curso, no favorita")).toBeInTheDocument();
    expect(screen.queryByText("Terminada y favorita")).not.toBeInTheDocument();
    expect(screen.queryByText("Wishlist, no tenida")).not.toBeInTheDocument();
  });

  it("un-presses a status chip clicked twice, showing every status again", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    const chip = screen.getByRole("button", { name: "En curso" });
    await user.click(chip);
    await user.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "false");
    for (const entry of ITEMS) {
      expect(screen.getByText(entry.title)).toBeInTheDocument();
    }
  });

  it("pressing one status chip releases the previously pressed one", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

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
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    const chip = screen.getByRole("button", { name: "Favoritos" });
    await user.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Terminada y favorita")).toBeInTheDocument();
    expect(screen.queryByText("En curso, no favorita")).not.toBeInTheDocument();
  });

  it("filters by owned only when the owned chip is pressed", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    const chip = screen.getByRole("button", { name: "En propiedad" });
    await user.click(chip);

    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Terminada y favorita")).toBeInTheDocument();
    expect(screen.getByText("En curso, no favorita")).toBeInTheDocument();
    expect(screen.queryByText("Wishlist, no tenida")).not.toBeInTheDocument();
  });

  it("shows a filter-specific empty state, keeping the active filter and offering to clear it", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    const chip = screen.getByRole("button", { name: "Abandonado" });
    await user.click(chip);

    expect(
      screen.getByText(/no hay obras con estos filtros/i),
    ).toBeInTheDocument();
    // The filter itself stays visible and pressed — it is not silently reset.
    expect(chip).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /quitar filtros/i }));

    expect(chip).toHaveAttribute("aria-pressed", "false");
    for (const entry of ITEMS) {
      expect(screen.getByText(entry.title)).toBeInTheDocument();
    }
  });

  it("shows a search-specific empty state naming the term, and offers to clear only the search", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    const search = screen.getByRole("searchbox", { name: /buscar/i });
    await user.type(search, "no-existe-nada-así");

    const empty = await screen.findByText(/no-existe-nada-así/);
    expect(empty).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /limpiar búsqueda/i }));

    expect(search).toHaveValue("");
    for (const entry of ITEMS) {
      expect(screen.getByText(entry.title)).toBeInTheDocument();
    }
  });

  it("prioritizes the search-specific empty state when both a search and a filter match nothing", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    await user.click(screen.getByRole("button", { name: "Abandonado" }));
    await user.type(screen.getByRole("searchbox", { name: /buscar/i }), "algo");

    expect(await screen.findByText(/algo/)).toBeInTheDocument();
    expect(
      screen.queryByText(/no hay obras con estos filtros/i),
    ).not.toBeInTheDocument();
  });

  it("politely announces the settled result count after filtering, without spamming every keystroke", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    await user.click(screen.getByRole("button", { name: "En curso" }));

    const announcement = await screen.findByRole("status");
    await waitFor(() => expect(announcement).toHaveTextContent(/1 resultado/i));
  });

  it("filters by a text search matching the title", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    const search = screen.getByRole("searchbox", { name: /buscar/i });
    await user.type(search, "wishlist");

    expect(screen.getByText("Wishlist, no tenida")).toBeInTheDocument();
    expect(screen.queryByText("Terminada y favorita")).not.toBeInTheDocument();
    expect(screen.queryByText("En curso, no favorita")).not.toBeInTheDocument();
  });

  it("search is case-insensitive", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    const search = screen.getByRole("searchbox", { name: /buscar/i });
    await user.type(search, "TERMINADA");

    expect(screen.getByText("Terminada y favorita")).toBeInTheDocument();
    expect(screen.queryByText("En curso, no favorita")).not.toBeInTheDocument();
  });

  it("offers a sort selector defaulting to Recientes", () => {
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    // A Radix trigger shows the label, not the underlying value.
    const sort = screen.getByRole("combobox", { name: /ordenar/i });
    expect(sort).toHaveTextContent("Recientes");
  });

  it("sorts alphabetically by title when Alfabético is selected", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

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
    const rated: LibraryItem[] = [
      item({ id: "a", title: "Ocho", rating: 8 }),
      item({ id: "b", title: "Diez", rating: 10 }),
      item({ id: "c", title: "Sin nota", rating: null }),
    ];
    render(<CategoryWorksBrowser items={rated} category="anime" />);

    await user.click(screen.getByRole("combobox", { name: /ordenar/i }));
    await user.click(await screen.findByRole("option", { name: "Valoración" }));

    const titles = screen
      .getAllByTestId("work-card-title")
      .map((title) => title.textContent);
    expect(titles).toEqual(["Diez", "Ocho", "Sin nota"]);
  });

  it("follows the three artboards: two columns, then three, then six", () => {
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    /*
     * The mockup draws `1fr 1fr` at 390 px, `repeat(3,1fr)` at 1024 px and
     * `repeat(6,1fr)` at 1440 px. Six columns used to start at `lg:`
     * (1024 px), so the tablet artboard's width rendered the desktop grid
     * under a tablet header (issue #63).
     */
    const grid = screen.getByTestId("category-works-grid");
    expect(grid).toHaveClass("grid-cols-2", "md:grid-cols-3", "xl:grid-cols-6");
  });

  it("cascades cards in, each a beat after the last", () => {
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    const cards = screen
      .getAllByTestId("work-card-title")
      .map((title) => title.closest(".stagger-in") as HTMLElement);

    for (const card of cards) {
      expect(card).toHaveClass("stagger-in");
    }
    expect(cards[0].style.getPropertyValue("--i")).toBe("0");
    expect(cards[1].style.getPropertyValue("--i")).toBe("1");
  });

  it("removes a filtered-out card, instead of leaving it forever", async () => {
    const user = userEvent.setup();
    render(<CategoryWorksBrowser items={ITEMS} category="anime" />);

    await user.click(screen.getByRole("button", { name: "En curso" }));

    await waitFor(() =>
      expect(
        screen.queryByText("Terminada y favorita"),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows an empty state instead of the filter bar when the category holds nothing", () => {
    render(<CategoryWorksBrowser items={[]} category="anime" />);

    expect(
      screen.getByText(/aún no has añadido ninguna obra/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: /buscar/i }),
    ).not.toBeInTheDocument();
  });

  it("links the empty state's action to the category's add-search page", () => {
    render(<CategoryWorksBrowser items={[]} category="tcg" />);

    expect(
      screen.getByRole("link", { name: /añadir una obra/i }),
    ).toHaveAttribute("href", "/anadir/tcg");
  });
});
