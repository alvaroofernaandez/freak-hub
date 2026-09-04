import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { countByCategory, MOCK_WORKS } from "@/features/library/lib/mock-works";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/shared/ui/category-stripe";
import LibraryLobbyPage from "./page";

describe("LibraryLobbyPage", () => {
  it("renders the six categories, each linking to its own listing with its real count", () => {
    render(<LibraryLobbyPage />);

    const counts = countByCategory(MOCK_WORKS);

    for (const category of CATEGORY_ORDER) {
      const link = screen.getByRole("link", {
        name: new RegExp(CATEGORY_LABELS[category]),
      });
      expect(link).toHaveAttribute("href", `/biblioteca/${category}`);
      expect(link).toHaveTextContent(String(counts[category]));
    }
  });
});
