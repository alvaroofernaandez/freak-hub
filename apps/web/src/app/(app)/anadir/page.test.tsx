import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/shared/ui/category-stripe";
import AddCategoryPickerPage from "./page";

describe("AddCategoryPickerPage", () => {
  it("renders the six categories, each linking to its own add-search flow", () => {
    render(<AddCategoryPickerPage />);

    for (const category of CATEGORY_ORDER) {
      const link = screen.getByRole("link", {
        name: new RegExp(CATEGORY_LABELS[category]),
      });
      expect(link).toHaveAttribute("href", `/anadir/${category}`);
    }
  });
});
