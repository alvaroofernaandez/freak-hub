import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CATEGORY_LABELS } from "@/shared/ui/category-stripe";

const notFound = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const { default: CategoryLibraryPage } = await import("./page");

describe("CategoryLibraryPage", () => {
  it("renders the category's label and its works for a valid category", async () => {
    const page = await CategoryLibraryPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", { name: CATEGORY_LABELS.anime }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound for a category that does not exist", async () => {
    await CategoryLibraryPage({
      params: Promise.resolve({ categoria: "not-a-category" }),
    });

    expect(notFound).toHaveBeenCalled();
  });
});
