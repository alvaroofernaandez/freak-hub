import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataControls } from "./data-controls";

describe("DataControls", () => {
  it("offers exporting and deleting, because the data belongs to whoever wrote it", () => {
    render(<DataControls />);

    expect(
      screen.getByRole("button", { name: /exportar mis datos/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /borrar mis datos/i }),
    ).toBeInTheDocument();
  });

  it("keeps both switched off, rather than faking an action the API cannot do yet", () => {
    render(<DataControls />);

    expect(
      screen.getByRole("button", { name: /exportar mis datos/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /borrar mis datos/i }),
    ).toBeDisabled();
  });

  it("says out loud why they are off, instead of leaving two dead buttons", () => {
    render(<DataControls />);

    expect(screen.getByText(/todavía no/i)).toBeInTheDocument();
  });

  it("ties the explanation to both buttons, so it is announced with them", () => {
    render(<DataControls />);

    const explanation = screen.getByText(/todavía no/i);
    for (const name of [/exportar mis datos/i, /borrar mis datos/i]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute(
        "aria-describedby",
        explanation.id,
      );
    }
  });
});
