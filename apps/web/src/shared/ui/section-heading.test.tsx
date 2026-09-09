import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionHeading } from "./section-heading";

describe("SectionHeading", () => {
  it("titles the section as a level-2 heading", () => {
    render(<SectionHeading title="Miembros" count={12} />);

    expect(
      screen.getByRole("heading", { level: 2, name: /miembros/i }),
    ).toBeInTheDocument();
  });

  it("shows how many there are, in the mono face used for figures", () => {
    render(<SectionHeading title="Miembros" count={12} />);

    expect(screen.getByText("12")).toHaveClass("font-mono");
  });

  it("shows a zero count rather than hiding it", () => {
    render(<SectionHeading title="Invitaciones" count={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("omits the counter entirely when there is no count to show", () => {
    render(<SectionHeading title="Miembros" />);

    expect(
      screen.queryByTestId("section-heading-count"),
    ).not.toBeInTheDocument();
  });

  it("carries an optional description under the title", () => {
    render(
      <SectionHeading
        title="Invitaciones"
        description="Personas invitadas que todavía no han entrado."
      />,
    );

    expect(
      screen.getByText("Personas invitadas que todavía no han entrado."),
    ).toBeInTheDocument();
  });
});
