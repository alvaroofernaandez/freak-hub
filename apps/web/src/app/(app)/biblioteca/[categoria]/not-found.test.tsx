import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("category not-found", () => {
  it("says the category does not exist and offers to go back to the library", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "Esta categoría no existe" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a la biblioteca" }),
    ).toHaveAttribute("href", "/biblioteca");
  });
});
