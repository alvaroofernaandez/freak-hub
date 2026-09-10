import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("member not-found", () => {
  it("says the member is not in the group and offers to go back to it", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "Este miembro no está en el grupo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver al grupo" }),
    ).toHaveAttribute("href", "/miembros");
  });
});
