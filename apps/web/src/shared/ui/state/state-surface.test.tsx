import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StateSurface } from "./state-surface";

describe("StateSurface", () => {
  it("renders the title at the requested heading level", () => {
    render(
      <StateSurface size="page" title="No se ha encontrado" headingLevel={1} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "No se ha encontrado" }),
    ).toBeInTheDocument();
  });

  it("defaults to a level-2 heading", () => {
    render(<StateSurface size="section" title="Título" />);

    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("renders the description with a readable measure, only when given", () => {
    const { rerender } = render(
      <StateSurface
        size="page"
        title="Título"
        description="Una explicación."
      />,
    );
    expect(screen.getByText("Una explicación.")).toHaveClass("max-w-[65ch]");

    rerender(<StateSurface size="page" title="Título" />);
    expect(screen.queryByText("Una explicación.")).not.toBeInTheDocument();
  });

  it("hides a decorative icon from assistive tech", () => {
    render(
      <StateSurface
        size="page"
        title="Título"
        icon={<svg data-testid="icon" />}
      />,
    );

    expect(screen.getByTestId("icon").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("renders no icon wrapper at all when none is given", () => {
    const { container } = render(<StateSurface size="page" title="Título" />);
    expect(container.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("renders the primary action, and the secondary only alongside it", () => {
    render(
      <StateSurface
        size="page"
        title="Título"
        primaryAction={<button type="button">Reintentar</button>}
        secondaryAction={<button type="button">Volver</button>}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("renders a support reference when given", () => {
    render(
      <StateSurface
        size="page"
        title="Título"
        supportReference={<span>Referencia: abc</span>}
      />,
    );

    expect(screen.getByText("Referencia: abc")).toBeInTheDocument();
  });

  it("centers page and section sizes, left-aligns inline", () => {
    const { container: pageContainer } = render(
      <StateSurface size="page" title="Título" />,
    );
    expect(pageContainer.firstElementChild).toHaveClass("text-center");

    const { container: inlineContainer } = render(
      <StateSurface size="inline" title="Título" />,
    );
    expect(inlineContainer.firstElementChild).not.toHaveClass("text-center");
  });
});
