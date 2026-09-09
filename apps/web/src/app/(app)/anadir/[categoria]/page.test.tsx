import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

  it("renders a disabled search field", async () => {
    notFound.mockClear();
    const page = await AddSearchPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    expect(screen.getByRole("searchbox")).toBeDisabled();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("gives the search field the mockup's accent border", async () => {
    const page = await AddSearchPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    expect(screen.getByRole("searchbox")).toHaveClass("border-accent");
  });

  it("constrains the content to the mockup's max width", async () => {
    const page = await AddSearchPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    expect(screen.getByTestId("add-search-content")).toHaveClass(
      "max-w-[820px]",
    );
  });

  it("says honestly that the catalog search is not connected yet, instead of showing fake results", async () => {
    const page = await AddSearchPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    expect(screen.getByText(/todavía no está disponible/i)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("links back to the library", async () => {
    const page = await AddSearchPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    expect(screen.getByRole("link", { name: /volver/i })).toHaveAttribute(
      "href",
      "/biblioteca",
    );
  });

  it("links to the manual add page as an alternative", async () => {
    const page = await AddSearchPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    expect(screen.getByRole("link", { name: /alta manual/i })).toHaveAttribute(
      "href",
      "/anadir/anime/manual",
    );
  });
});
