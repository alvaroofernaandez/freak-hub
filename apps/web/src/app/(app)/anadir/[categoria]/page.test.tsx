import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogSearchOutcome } from "@/features/library/lib/anilist";

const notFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/anadir/anime",
}));

const searchAnime = vi.fn();
vi.mock("@/features/library/lib/anilist", () => ({
  searchAnime: (...args: unknown[]) => searchAnime(...args),
}));

const { default: AddSearchPage } = await import("./page");

function open(categoria: string, q?: string) {
  return AddSearchPage({
    params: Promise.resolve({ categoria }),
    searchParams: Promise.resolve(q === undefined ? {} : { q }),
  });
}

async function renderPage(categoria: string, q?: string) {
  const page = await open(categoria, q);
  render(page);
}

function outcome(value: CatalogSearchOutcome) {
  searchAnime.mockResolvedValue(value);
}

describe("AddSearchPage", () => {
  beforeEach(() => {
    notFound.mockReset();
    searchAnime.mockReset();
    outcome({ status: "empty" });
  });

  it("calls notFound for a category that does not exist", async () => {
    await open("not-a-category");

    expect(notFound).toHaveBeenCalled();
  });

  it("constrains the content to the mockup's max width", async () => {
    await renderPage("anime");

    expect(screen.getByTestId("add-search-content")).toHaveClass(
      "max-w-[820px]",
    );
  });

  it("links back to the library", async () => {
    await renderPage("anime");

    expect(screen.getByRole("link", { name: /volver/i })).toHaveAttribute(
      "href",
      "/biblioteca",
    );
  });

  it("links to the manual add page as an alternative", async () => {
    await renderPage("anime");

    expect(screen.getByRole("link", { name: /alta manual/i })).toHaveAttribute(
      "href",
      "/anadir/anime/manual",
    );
  });

  describe("anime, the one category with a catalog behind it", () => {
    it("opens the search field instead of showing it disabled", async () => {
      await renderPage("anime");

      expect(screen.getByRole("searchbox")).toBeEnabled();
      expect(notFound).not.toHaveBeenCalled();
    });

    it("invites you to type before it has searched anything, without calling the catalog", async () => {
      await renderPage("anime");

      expect(searchAnime).not.toHaveBeenCalled();
      expect(screen.getByText(/busca un anime/i)).toBeInTheDocument();
    });

    it("searches the catalog for the term in the URL and lists what it found", async () => {
      outcome({
        status: "ok",
        results: [
          { id: "anilist:1535", title: "Death Note", year: 2006 },
          { id: "anilist:21", title: "One Piece", year: 1999 },
        ],
      });

      await renderPage("anime", "death note");

      expect(searchAnime).toHaveBeenCalledWith(
        "death note",
        expect.objectContaining({ limit: expect.any(Number) }),
      );
      expect(screen.getByText("Death Note")).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("quotes the term back when the catalog found nothing", async () => {
      outcome({ status: "empty" });

      await renderPage("anime", "zzzzzz");

      expect(screen.getByText(/zzzzzz/)).toBeInTheDocument();
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    });

    it("explains a rate limit as a pause, not as an empty result", async () => {
      outcome({ status: "rate_limited", retryAfterSeconds: 30 });

      await renderPage("anime", "naruto");

      expect(
        screen.getByRole("heading", { name: /demasiadas búsquedas/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    });

    it("offers the manual entry when the catalog is unreachable", async () => {
      outcome({ status: "unavailable" });

      await renderPage("anime", "naruto");

      expect(
        screen.getByRole("heading", { name: /no responde/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /alta manual/i }),
      ).toBeInTheDocument();
    });

    it("never names the catalog or its failure mode on screen", async () => {
      outcome({ status: "unavailable" });

      await renderPage("anime", "naruto");

      expect(
        screen.getByTestId("add-search-content").textContent ?? "",
      ).not.toMatch(/anilist|graphql|http|429|503|fetch/i);
    });

    it("cuts an oversized q down to size, in the search and in the echo", async () => {
      const { SEARCH_MAX_LENGTH } = await import(
        "@/features/library/lib/catalog-search"
      );
      outcome({ status: "empty" });

      await renderPage("anime", "a".repeat(20_000));

      expect(searchAnime).toHaveBeenCalledWith(
        "a".repeat(SEARCH_MAX_LENGTH),
        expect.anything(),
      );
      expect(
        screen.getByRole("heading", { name: /no hay resultados/i }).textContent
          ?.length ?? 0,
      ).toBeLessThan(SEARCH_MAX_LENGTH + 40);
    });

    it("ignores a repeated q parameter instead of searching for an array", async () => {
      const page = await AddSearchPage({
        params: Promise.resolve({ categoria: "anime" }),
        searchParams: Promise.resolve({ q: ["uno", "dos"] }),
      });
      render(page);

      expect(searchAnime).not.toHaveBeenCalled();
    });
  });

  describe("the other five categories, untouched until they get their own catalog", () => {
    it("keeps the search field disabled", async () => {
      await renderPage("game");

      expect(screen.getByRole("searchbox")).toBeDisabled();
    });

    it("says honestly that the catalog search is not connected yet, instead of showing fake results", async () => {
      await renderPage("game");

      expect(
        screen.getByText(/todavía no está disponible/i),
      ).toBeInTheDocument();
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    });

    it("gives the search field the mockup's accent border", async () => {
      await renderPage("game");

      expect(screen.getByRole("searchbox")).toHaveClass("border-accent");
    });

    it("never reaches the anime catalog, even with a term in the URL", async () => {
      await renderPage("film", "matrix");

      expect(searchAnime).not.toHaveBeenCalled();
    });
  });
});
