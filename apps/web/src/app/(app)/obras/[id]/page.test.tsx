import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntry } from "@/shared/api/types";

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

const { default: WorkPage } = await import("./page");
const { ApiError } = await import("@/shared/lib/api-client");

const ENTRY: LibraryEntry = {
  id: "entry-fma",
  work: {
    id: "work-fma",
    title: "Fullmetal Alchemist: Brotherhood",
    category: "anime",
    source: "anilist",
    source_id: "5114",
    cover_url: null,
    synopsis: null,
    year: 2009,
    metadata: { episodes: 64, season: "2009-spring" },
    expansion_of: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  status: "in_progress",
  progress: 32,
  rating: null,
  is_favourite: true,
  owned: false,
  note: "Uno de los mejores finales.",
  started_at: "2026-01-15T00:00:00.000Z",
  finished_at: null,
  created_at: "2026-01-10T00:00:00.000Z",
  updated_at: "2026-02-01T00:00:00.000Z",
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("WorkPage", () => {
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

  it("reads the entry by its own id, which is what the [id] segment holds", async () => {
    apiFetch.mockResolvedValue(ENTRY);

    render(await WorkPage(params("entry-fma")));

    expect(apiFetch).toHaveBeenCalledWith("/v1/library/entry-fma", {
      token: "session-token",
    });
  });

  it("renders the work's header from the Work embedded in the entry", async () => {
    apiFetch.mockResolvedValue(ENTRY);

    render(await WorkPage(params("entry-fma")));

    expect(
      screen.getByRole("heading", {
        name: "Fullmetal Alchemist: Brotherhood",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("work-page-header-metadata")).toHaveTextContent(
      "2009 · 64 episodios · Primavera",
    );
    expect(notFound).not.toHaveBeenCalled();
  });

  it("renders the member's own entry beside it", async () => {
    apiFetch.mockResolvedValue(ENTRY);

    render(await WorkPage(params("entry-fma")));

    expect(
      screen.getByRole("heading", { name: "Tu entrada" }),
    ).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
    expect(screen.getByText("Uno de los mejores finales.")).toBeInTheDocument();
  });

  it("widens the entry's category in the moulding", async () => {
    apiFetch.mockResolvedValue(ENTRY);

    render(await WorkPage(params("entry-fma")));

    expect(screen.getByTestId("active-category")).toHaveAttribute(
      "data-category",
      "anime",
    );
  });

  it("is a real 404 when the entry is not the caller's, or never existed", async () => {
    apiFetch.mockRejectedValue(
      new ApiError("no entry", 404, "library_entry_not_found"),
    );

    await expect(WorkPage(params("someone-elses-entry"))).rejects.toThrow(
      /404/,
    );

    expect(notFound).toHaveBeenCalled();
  });

  it("is not a 404 while the account is still being prepared, even though that is a 404 too", async () => {
    apiFetch.mockRejectedValue(
      new ApiError("not ready", 404, "unknown_identity"),
    );

    render(await WorkPage(params("entry-fma")));

    expect(notFound).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /todavía no está lista/i }),
    ).toBeInTheDocument();
  });

  it("shows the session-expired state for a 401, returning to this work", async () => {
    apiFetch.mockRejectedValue(new ApiError("no token", 401, "invalid_token"));

    render(await WorkPage(params("entry-fma")));

    expect(notFound).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/entrar?redirect_url=%2Fobras%2Fentry-fma");
  });

  it("never turns a server failure into 'this work does not exist'", async () => {
    apiFetch.mockRejectedValue(new ApiError("boom", 500, "internal_error"));

    render(await WorkPage(params("entry-fma")));

    expect(notFound).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });
});
