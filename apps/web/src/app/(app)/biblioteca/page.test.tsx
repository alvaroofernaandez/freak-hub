import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntry, LibraryEntryPage } from "@/shared/api/types";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/shared/ui/category-stripe";

const getToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => Promise.resolve({ getToken }),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const apiFetch = vi.fn();
vi.mock("@/shared/lib/api-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/lib/api-client")
  >("@/shared/lib/api-client");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const { default: LibraryLobbyPage } = await import("./page");
const { ApiError } = await import("@/shared/lib/api-client");

function entry(
  id: string,
  category: LibraryEntry["work"]["category"],
): LibraryEntry {
  return {
    id,
    work: {
      id: `work-${id}`,
      title: `Obra ${id}`,
      category,
      source: "manual",
      source_id: null,
      cover_url: null,
      synopsis: null,
      year: null,
      metadata: {},
      expansion_of: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    status: "completed",
    progress: 0,
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

const LIBRARY: LibraryEntryPage = {
  items: [entry("1", "anime"), entry("2", "anime"), entry("3", "manga")],
  next_cursor: null,
};

describe("LibraryLobbyPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    getToken.mockReset();
    getToken.mockResolvedValue("session-token");
  });

  it("asks for the whole library once, at the contract's page-size maximum", async () => {
    apiFetch.mockResolvedValue(LIBRARY);

    render(await LibraryLobbyPage());

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith("/v1/library?limit=100", {
      token: "session-token",
    });
  });

  it("titles the page 'Tu biblioteca', matching the high-fidelity lobby mockup", async () => {
    apiFetch.mockResolvedValue(LIBRARY);

    render(await LibraryLobbyPage());

    expect(
      screen.getByRole("heading", { name: "Tu biblioteca" }),
    ).toBeInTheDocument();
  });

  it("counts each category from the entries it got back, not from zero", async () => {
    apiFetch.mockResolvedValue(LIBRARY);

    render(await LibraryLobbyPage());

    expect(
      screen.getByRole("link", { name: new RegExp(CATEGORY_LABELS.anime) }),
    ).toHaveTextContent("2");
    expect(
      screen.getByRole("link", { name: new RegExp(CATEGORY_LABELS.manga) }),
    ).toHaveTextContent("1");
    expect(
      screen.getByRole("link", { name: new RegExp(CATEGORY_LABELS.game) }),
    ).toHaveTextContent("0");
  });

  it("still shows all six categories, each linking to its own listing", async () => {
    apiFetch.mockResolvedValue({ items: [], next_cursor: null });

    render(await LibraryLobbyPage());

    for (const category of CATEGORY_ORDER) {
      expect(
        screen.getByRole("link", {
          name: new RegExp(CATEGORY_LABELS[category]),
        }),
      ).toHaveAttribute("href", `/biblioteca/${category}`);
    }
  });

  it("cascades the cards in as they mount, each a beat after the last", async () => {
    apiFetch.mockResolvedValue(LIBRARY);

    render(await LibraryLobbyPage());

    CATEGORY_ORDER.forEach((category, index) => {
      const link = screen.getByRole("link", {
        name: new RegExp(CATEGORY_LABELS[category]),
      });
      expect(link).toHaveClass("stagger-in");
      expect(link.style.getPropertyValue("--i")).toBe(String(index));
    });
  });

  it("says the counts are partial rather than passing a truncated figure off as the total", async () => {
    apiFetch.mockResolvedValue({ ...LIBRARY, next_cursor: "cursor-1" });

    render(await LibraryLobbyPage());

    expect(screen.getByTestId("library-counts-partial")).toBeInTheDocument();
  });

  it("says nothing about truncation when the whole library fits in one page", async () => {
    apiFetch.mockResolvedValue(LIBRARY);

    render(await LibraryLobbyPage());

    expect(
      screen.queryByTestId("library-counts-partial"),
    ).not.toBeInTheDocument();
  });

  it("shows the session-expired state, not zero counts, for a 401", async () => {
    apiFetch.mockRejectedValue(new ApiError("no token", 401, "invalid_token"));

    render(await LibraryLobbyPage());

    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/entrar?redirect_url=%2Fbiblioteca");
  });

  it("reads a 404 unknown_identity as an account still being prepared, not as an empty library", async () => {
    apiFetch.mockRejectedValue(
      new ApiError("not ready", 404, "unknown_identity"),
    );

    render(await LibraryLobbyPage());

    expect(
      screen.getByRole("heading", { name: /todavía no está lista/i }),
    ).toBeInTheDocument();
  });

  it("shows a retryable error, and never six zeroes, when the request fails", async () => {
    apiFetch.mockRejectedValue(new ApiError("boom", 500, "internal_error"));

    render(await LibraryLobbyPage());

    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /anime/i }),
    ).not.toBeInTheDocument();
  });
});
