import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("(app) not-found", () => {
  it("explains nothing was found and offers a way back into the shell", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "No se ha encontrado" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a inicio" })).toHaveAttribute(
      "href",
      "/inicio",
    );
  });
});
