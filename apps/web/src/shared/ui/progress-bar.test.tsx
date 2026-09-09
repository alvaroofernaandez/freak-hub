import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("exposes the value to assistive tech, not just visually", () => {
    render(<ProgressBar value={40} label="Progreso de Elden Ring" />);

    const bar = screen.getByRole("progressbar", {
      name: "Progreso de Elden Ring",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("fills to the given percentage", () => {
    render(<ProgressBar value={40} label="Progreso" />);

    expect(screen.getByTestId("progress-bar-fill")).toHaveStyle({
      width: "40%",
    });
  });

  it("eases the fill as it grows, and holds still under reduced motion", () => {
    render(<ProgressBar value={40} label="Progreso" />);

    const fill = screen.getByTestId("progress-bar-fill");
    expect(fill).toHaveClass("transition-[width]");
    expect(fill).toHaveClass("motion-reduce:transition-none");
  });

  it("clamps values that fall outside 0-100", () => {
    const { rerender } = render(<ProgressBar value={-20} label="Progreso" />);
    expect(screen.getByTestId("progress-bar-fill")).toHaveStyle({
      width: "0%",
    });

    rerender(<ProgressBar value={140} label="Progreso" />);
    expect(screen.getByTestId("progress-bar-fill")).toHaveStyle({
      width: "100%",
    });
  });
});
