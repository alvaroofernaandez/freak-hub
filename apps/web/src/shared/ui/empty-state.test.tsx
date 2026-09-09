import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("announces the title as a heading so screen readers can reach it", () => {
    render(<EmptyState title="Tu biblioteca está vacía" />);

    expect(
      screen.getByRole("heading", { name: "Tu biblioteca está vacía" }),
    ).toBeInTheDocument();
  });

  it("explains why the screen is empty when a description is given", () => {
    render(
      <EmptyState
        title="Tu biblioteca está vacía"
        description="Añade tu primera obra para verla aquí."
      />,
    );

    expect(
      screen.getByText("Añade tu primera obra para verla aquí."),
    ).toBeInTheDocument();
  });

  it("renders the action slot so a screen can offer the next step", () => {
    render(
      <EmptyState
        title="Tu biblioteca está vacía"
        action={<a href="/anadir">Añadir una obra</a>}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Añadir una obra" }),
    ).toHaveAttribute("href", "/anadir");
  });

  it("carries the decorative moulding, hidden from assistive tech", () => {
    render(<EmptyState title="Sin actividad" />);

    expect(screen.getByTestId("moulding")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
