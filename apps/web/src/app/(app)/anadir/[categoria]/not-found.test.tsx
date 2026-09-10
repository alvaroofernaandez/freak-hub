import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("add-flow category not-found", () => {
  it("says the category does not exist and offers to go back to the library", () => {
    // The nearest `not-found.tsx` above `/anadir/[categoria]` also catches
    // `notFound()` thrown from `/anadir/[categoria]/manual` — one file
    // covers both routes.
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "Esta categoría no existe" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a la biblioteca" }),
    ).toHaveAttribute("href", "/biblioteca");
  });
});
