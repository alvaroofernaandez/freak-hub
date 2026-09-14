import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntry, LibraryEntryPage } from "@/shared/api/types";
import { CATEGORY_LABELS } from "@/shared/ui/category-stripe";

const getToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => Promise.resolve({ getToken }),
}));

/** The real `notFound()` throws, which is what stops a page mid-render. A
 * plain `vi.fn()` would return, letting the page run on past it and fail for
 * a reason the production code never has. */
const notFound = vi.fn(() => {
  throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const apiFetch = vi.fn();
vi.mock("@/shared/lib/api-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/lib/api-client")
  >("@/shared/lib/api-client");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const { default: CategoryLibraryPage } = await import("./page");
const { ApiError } = await import("@/shared/lib/api-client");

function entry(id: string, title: string): LibraryEntry {
  return {
    id,
    work: {
      id: `work-${id}`,
      title,
      category: "anime",
      source: "anilist",
      source_id: "1",
      cover_url: null,
      synopsis: null,
      year: 2009,
      metadata: { episodes: 64 },
      expansion_of: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    status: "in_progress",
    progress: 12,
    rating: null,
    is_favourite: false,
    owned: false,
    note: null,
    started_at: null,
    finished_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const PAGE: LibraryEntryPage = {
  items: [entry("1", "Fullmetal Alchemist"), entry("2", "Hunter x Hunter")],
  next_cursor: null,
};

function params(categoria: string) {
  return { params: Promise.resolve({ categoria }) };
}

describe("CategoryLibraryPage", () => {
  // `notFound` lives at module scope and its call history outlives a single
  // test, so without this the suite passes or fails depending on the order it
  // runs in (`--sequence.shuffle`): a `not.toHaveBeenCalled()` sees the call
  // another test made.
  beforeEach(() => {
    notFound.mockClear();
    apiFetch.mockReset();
    getToken.mockReset();
    getToken.mockResolvedValue("session-token");
  });

  it("asks the API for that category only, instead of filtering the whole library here", async () => {
    apiFetch.mockResolvedValue(PAGE);

    render(await CategoryLibraryPage(params("anime")));

    expect(apiFetch).toHaveBeenCalledWith(
      "/v1/library?category=anime&limit=100",
      { token: "session-token" },
    );
  });

  it("renders the category's label and the entries it got back", async () => {
    apiFetch.mockResolvedValue(PAGE);

    render(await CategoryLibraryPage(params("anime")));

    expect(
      screen.getByRole("heading", { name: CATEGORY_LABELS.anime }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fullmetal Alchemist")).toBeInTheDocument();
    expect(screen.getByText("Hunter x Hunter")).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("counts the entries beside the title, as the mockup does", async () => {
    apiFetch.mockResolvedValue(PAGE);

    render(await CategoryLibraryPage(params("anime")));

    expect(screen.getByTestId("category-count")).toHaveTextContent("2 obras");
  });

  it("agrees with a single entry in the singular", async () => {
    apiFetch.mockResolvedValue({
      items: [entry("1", "Sola")],
      next_cursor: null,
    });

    render(await CategoryLibraryPage(params("anime")));

    expect(screen.getByTestId("category-count")).toHaveTextContent("1 obra");
  });

  it("finally renders the filter chips, the search and the sort, now that there is something to filter", async () => {
    apiFetch.mockResolvedValue(PAGE);

    render(await CategoryLibraryPage(params("anime")));

    expect(
      screen.getByRole("button", { name: "En curso", pressed: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /buscar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /ordenar/i }),
    ).toBeInTheDocument();
  });

  it("shows the honest empty state, not the filter bar, when the category holds nothing", async () => {
    apiFetch.mockResolvedValue({ items: [], next_cursor: null });

    render(await CategoryLibraryPage(params("anime")));

    expect(
      screen.getByText(/aún no has añadido ninguna obra/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: /buscar/i }),
    ).not.toBeInTheDocument();
  });

  it("marks the category active in the moulding", async () => {
    apiFetch.mockResolvedValue(PAGE);

    render(await CategoryLibraryPage(params("anime")));

    expect(screen.getByTestId("active-category")).toHaveAttribute(
      "data-category",
      "anime",
    );
  });

  it("calls notFound for a category that does not exist, without asking the API", async () => {
    await expect(CategoryLibraryPage(params("not-a-category"))).rejects.toThrow(
      /404/,
    );

    expect(notFound).toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("says there is more than fits, instead of truncating in silence", async () => {
    apiFetch.mockResolvedValue({ ...PAGE, next_cursor: "cursor-1" });

    render(await CategoryLibraryPage(params("anime")));

    expect(screen.getByTestId("category-has-more")).toBeInTheDocument();
  });

  it("shows the session-expired state for a 401, returning to this category", async () => {
    apiFetch.mockRejectedValue(new ApiError("no token", 401, "invalid_token"));

    render(await CategoryLibraryPage(params("anime")));

    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/entrar?redirect_url=%2Fbiblioteca%2Fanime");
  });

  it("shows a retryable error, never an empty category, when the request fails", async () => {
    apiFetch.mockRejectedValue(
      new ApiError("boom", 503, "service_unavailable"),
    );

    render(await CategoryLibraryPage(params("anime")));

    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/aún no has añadido ninguna obra/i),
    ).not.toBeInTheDocument();
  });
});
