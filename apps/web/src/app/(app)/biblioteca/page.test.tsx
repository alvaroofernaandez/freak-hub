import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/shared/ui/category-stripe";
import LibraryLobbyPage from "./page";

describe("LibraryLobbyPage", () => {
  it("titles the page 'Tu biblioteca', matching the high-fidelity lobby mockup", () => {
    render(<LibraryLobbyPage />);

    expect(
      screen.getByRole("heading", { name: "Tu biblioteca" }),
    ).toBeInTheDocument();
  });

  it("renders the six categories, each linking to its own listing with a zero count (no library endpoint yet)", () => {
    render(<LibraryLobbyPage />);

    for (const category of CATEGORY_ORDER) {
      const link = screen.getByRole("link", {
        name: new RegExp(CATEGORY_LABELS[category]),
      });
      expect(link).toHaveAttribute("href", `/biblioteca/${category}`);
      expect(link).toHaveTextContent("0");
    }
  });

  it("cascades the cards in as they mount, each a beat after the last", () => {
    render(<LibraryLobbyPage />);

    CATEGORY_ORDER.forEach((category, index) => {
      const link = screen.getByRole("link", {
        name: new RegExp(CATEGORY_LABELS[category]),
      });
      expect(link).toHaveClass("stagger-in");
      expect(link.style.getPropertyValue("--i")).toBe(String(index));
    });
  });
});
