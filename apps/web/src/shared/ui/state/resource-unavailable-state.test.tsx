import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResourceUnavailableState } from "./resource-unavailable-state";

describe("ResourceUnavailableState", () => {
  it("explains what is missing and offers a single, concrete way back", () => {
    render(
      <ResourceUnavailableState
        size="page"
        title="Este miembro no está en el grupo"
        backHref="/miembros"
        backLabel="Volver al grupo"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Este miembro no está en el grupo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver al grupo" }),
    ).toHaveAttribute("href", "/miembros");
  });

  it("renders a description only when one is given", () => {
    const { rerender } = render(
      <ResourceUnavailableState
        size="page"
        title="t"
        description="d"
        backHref="/x"
        backLabel="Volver"
      />,
    );
    expect(screen.getByText("d")).toBeInTheDocument();

    rerender(
      <ResourceUnavailableState
        size="page"
        title="t"
        backHref="/x"
        backLabel="Volver"
      />,
    );
    expect(screen.queryByText("d")).not.toBeInTheDocument();
  });
});
