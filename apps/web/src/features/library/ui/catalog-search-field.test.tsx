import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/anadir/anime",
}));

const { CatalogSearchField, SEARCH_DEBOUNCE_MS } = await import(
  "./catalog-search-field"
);
const { SEARCH_MAX_LENGTH } = await import(
  "@/features/library/lib/catalog-search"
);

/**
 * `shouldAdvanceTime` keeps user-event's own internal waits running on real
 * time while the debounce stays under this file's control — without it,
 * typing deadlocks against the frozen clock.
 */
function setup() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return userEvent.setup();
}

function settle() {
  act(() => {
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
  });
}

describe("CatalogSearchField", () => {
  beforeEach(() => {
    replace.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is typeable, unlike the placeholder field the other categories still show", () => {
    render(
      <CatalogSearchField query="" announcement="">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    expect(screen.getByRole("searchbox", { name: /buscar/i })).toBeEnabled();
  });

  it("puts the term in the URL once the typing settles, not on every keystroke", async () => {
    const user = setup();
    render(
      <CatalogSearchField query="" announcement="">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    await user.type(screen.getByRole("searchbox"), "death note");
    expect(replace).not.toHaveBeenCalled();

    settle();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/anadir/anime?q=death+note", {
      scroll: false,
    });
  });

  it("drops the query from the URL when the field is emptied, instead of searching for nothing", async () => {
    const user = setup();
    render(
      <CatalogSearchField query="death note" announcement="1 resultado.">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    await user.clear(screen.getByRole("searchbox"));
    settle();

    expect(replace).toHaveBeenCalledWith("/anadir/anime", { scroll: false });
  });

  it("does not search again for the term already on screen", async () => {
    const user = setup();
    render(
      <CatalogSearchField query="death" announcement="1 resultado.">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    await user.type(screen.getByRole("searchbox"), "  ");
    settle();

    expect(replace).not.toHaveBeenCalled();
  });

  it("shows what it was given while nothing is in flight", () => {
    render(
      <CatalogSearchField query="death" announcement="1 resultado.">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    expect(screen.getByText("resultados")).toBeInTheDocument();
    expect(screen.queryByText(/buscando/i)).not.toBeInTheDocument();
  });

  it("says «Buscando…» in the region that was already mounted, not in a new one", async () => {
    // `pending-label.tsx` and docs/states.md both say it: a live region that
    // only enters the DOM once the state flips is missed by the browser's
    // watcher, which only observes nodes that were already there. So the
    // wait has to land in the region that carries the result count, and
    // there must not be a second one.
    const user = setup();
    render(
      <CatalogSearchField query="" announcement="">
        <p>resultados</p>
      </CatalogSearchField>,
    );
    const live = screen.getByTestId("catalog-search-announcement");

    await user.type(screen.getByRole("searchbox"), "death");
    settle();

    expect(screen.getByTestId("catalog-search-announcement")).toBe(live);
    expect(live).toHaveTextContent("Buscando…");
    expect(document.querySelectorAll("output")).toHaveLength(1);
  });

  it("does not leave the previous count spoken as if it were the new one", async () => {
    const user = setup();
    render(
      <CatalogSearchField query="death" announcement="12 resultados.">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    await user.type(screen.getByRole("searchbox"), " note");
    settle();

    expect(
      screen.getByTestId("catalog-search-announcement"),
    ).not.toHaveTextContent("12 resultados.");
  });

  it("replaces the stale results with a loading state while the new term is on its way", async () => {
    const user = setup();
    render(
      <CatalogSearchField query="" announcement="">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    await user.type(screen.getByRole("searchbox"), "death");
    settle();

    expect(screen.getByText(/buscando/i)).toBeInTheDocument();
    expect(screen.queryByText("resultados")).not.toBeInTheDocument();
  });

  it("stops loading as soon as the page comes back with the term it asked for", async () => {
    const user = setup();
    const { rerender } = render(
      <CatalogSearchField query="" announcement="">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    await user.type(screen.getByRole("searchbox"), "death");
    settle();
    rerender(
      <CatalogSearchField query="death" announcement="1 resultado.">
        <p>resultados nuevos</p>
      </CatalogSearchField>,
    );

    expect(screen.queryByText(/buscando/i)).not.toBeInTheDocument();
    expect(screen.getByText("resultados nuevos")).toBeInTheDocument();
  });

  it("announces the outcome politely, in a region that was already there", () => {
    const { rerender } = render(
      <CatalogSearchField query="" announcement="">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    const live = screen.getByTestId("catalog-search-announcement");
    expect(live).toHaveAttribute("aria-live", "polite");

    rerender(
      <CatalogSearchField query="death" announcement="12 resultados.">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    expect(screen.getByTestId("catalog-search-announcement")).toHaveTextContent(
      "12 resultados.",
    );
  });

  it("caps what can be typed, so a pasted wall of text cannot become a heading", () => {
    render(
      <CatalogSearchField query="" announcement="">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "maxlength",
      String(SEARCH_MAX_LENGTH),
    );
  });

  it("starts from the term already in the URL, so a shared link opens on its results", () => {
    render(
      <CatalogSearchField query="cowboy bebop" announcement="1 resultado.">
        <p>resultados</p>
      </CatalogSearchField>,
    );

    expect(screen.getByRole("searchbox")).toHaveValue("cowboy bebop");
  });
});
