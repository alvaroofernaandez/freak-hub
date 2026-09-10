import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("global not-found", () => {
  it("says the address does not exist and offers one safe way out", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "Esta dirección no existe" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/inicio");
  });
});
