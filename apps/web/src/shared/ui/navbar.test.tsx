import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { navLinks } from "@/shared/lib/nav-links";
import { Navbar } from "./navbar";

describe("Navbar", () => {
  it("links the wordmark to /inicio with the display font", () => {
    render(<Navbar />);

    const wordmark = screen.getByRole("link", { name: "Freak Hub" });
    expect(wordmark).toHaveAttribute("href", "/inicio");
    expect(wordmark).toHaveClass("font-display");
  });

  it("renders the four top-level links with their href", () => {
    render(<Navbar />);

    for (const link of navLinks) {
      expect(screen.getByRole("link", { name: link.label })).toHaveAttribute(
        "href",
        link.href,
      );
    }
  });

  it("links the add button to /anadir", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: /añadir/i })).toHaveAttribute(
      "href",
      "/anadir",
    );
  });

  it("does not render a badge when there are no pending recommendations", () => {
    render(<Navbar />);

    expect(
      screen.queryByLabelText(/recomendaciones pendientes/i),
    ).not.toBeInTheDocument();
  });

  it("does not render a badge when pendingRecommendations is 0", () => {
    render(<Navbar pendingRecommendations={0} />);

    expect(
      screen.queryByLabelText(/recomendaciones pendientes/i),
    ).not.toBeInTheDocument();
  });

  it("renders an accessible badge when there are pending recommendations", () => {
    render(<Navbar pendingRecommendations={3} />);

    expect(
      screen.getByLabelText("3 recomendaciones pendientes"),
    ).toBeInTheDocument();
  });

  it("renders the user slot", () => {
    render(<Navbar userSlot={<span>slot-de-usuario</span>} />);

    expect(screen.getByText("slot-de-usuario")).toBeInTheDocument();
  });
});
