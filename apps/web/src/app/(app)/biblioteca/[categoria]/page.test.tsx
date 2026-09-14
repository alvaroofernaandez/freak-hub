import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATEGORY_LABELS } from "@/shared/ui/category-stripe";

const notFound = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const { default: CategoryLibraryPage } = await import("./page");

describe("CategoryLibraryPage", () => {
  // `notFound` lives at module scope and its call history outlives a single
  // test, so without this the suite passes or fails depending on the order it
  // runs in (`--sequence.shuffle`): a `not.toHaveBeenCalled()` sees the call
  // another test made.
  beforeEach(() => {
    notFound.mockClear();
  });

  it("renders the category's label and its works for a valid category", async () => {
    const page = await CategoryLibraryPage({
      params: Promise.resolve({ categoria: "anime" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", { name: CATEGORY_LABELS.anime }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
    expect(screen.getByTestId("active-category")).toHaveAttribute(
      "data-category",
      "anime",
    );
  });

  it("calls notFound for a category that does not exist", async () => {
    await CategoryLibraryPage({
      params: Promise.resolve({ categoria: "not-a-category" }),
    });

    expect(notFound).toHaveBeenCalled();
  });
});
