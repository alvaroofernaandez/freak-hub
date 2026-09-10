import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("work not-found", () => {
  it("says the work is not available and offers to go back to the library", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "Esta obra no está disponible" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a la biblioteca" }),
    ).toHaveAttribute("href", "/biblioteca");
  });
});
