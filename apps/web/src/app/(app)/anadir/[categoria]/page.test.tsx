import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mockSearchResults } from "@/features/library/lib/mock-search-results";

const notFound = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const { default: AddSearchPage } = await import("./page");

describe("AddSearchPage", () => {
  it("calls notFound for a category that does not exist", async () => {
    notFound.mockClear();
    await AddSearchPage({
      params: Promise.resolve({ categoria: "not-a-category" }),
    });

    expect(notFound).toHaveBeenCalled();
  });

  it("renders a disabled search field with a construction note", async () => {
    notFound.mockClear();
    const page = await AddSearchPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(screen.getByText(/búsqueda en construcción/i)).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("lists the category's mock search results", async () => {
    const page = await AddSearchPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    for (const result of mockSearchResults("anime")) {
      expect(screen.getByText(result.title)).toBeInTheDocument();
    }
  });

  it("links to the manual add page as an alternative", async () => {
    const page = await AddSearchPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    expect(
      screen.getByRole("link", { name: /alta manual/i }),
    ).toHaveAttribute("href", "/anadir/anime/manual");
  });
});
