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

  it("fills to the given percentage with a clip-path reveal, not by scaling", () => {
    // `scale` on a rounded fill distorts its corners along the X axis only
    // (an ellipse instead of a circle at low percentages). A full-width
    // element revealed with `clip-path: inset(...)` keeps the fill's own
    // border-radius intact at every percentage.
    render(<ProgressBar value={40} label="Progreso" />);

    const fill = screen.getByTestId("progress-bar-fill");
    expect(fill).toHaveStyle({
      clipPath: "inset(0 60% 0 0 round 9999px)",
    });
  });

  it("eases the fill as it grows, and holds still under reduced motion", () => {
    render(<ProgressBar value={40} label="Progreso" />);

    const fill = screen.getByTestId("progress-bar-fill");
    expect(fill).toHaveClass("transition-[clip-path]");
    expect(fill).toHaveClass("duration-300");
    expect(fill).toHaveClass("ease-out-quint");
    expect(fill).toHaveClass("motion-reduce:transition-none");
  });

  it("clamps values that fall outside 0-100", () => {
    const { rerender } = render(<ProgressBar value={-20} label="Progreso" />);
    expect(screen.getByTestId("progress-bar-fill")).toHaveStyle({
      clipPath: "inset(0 100% 0 0 round 9999px)",
    });

    rerender(<ProgressBar value={140} label="Progreso" />);
    expect(screen.getByTestId("progress-bar-fill")).toHaveStyle({
      clipPath: "inset(0 0% 0 0 round 9999px)",
    });
  });
});
