import { render, screen, waitFor } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { AnimatedNumber } from "./animated-number";

describe("AnimatedNumber", () => {
  it("exposes the real value to assistive tech immediately, not the mid-roll one", () => {
    render(<AnimatedNumber value={7} />);

    expect(screen.getByText("7", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("formats with the Spanish locale by default", () => {
    render(<AnimatedNumber value={1234} />);

    expect(
      screen.getByText((1234).toLocaleString("es-ES"), {
        selector: ".sr-only",
      }),
    ).toBeInTheDocument();
  });

  it("accepts a custom formatter", () => {
    render(<AnimatedNumber value={3} format={(n) => `${n} obras`} />);

    expect(
      screen.getByText("3 obras", { selector: ".sr-only" }),
    ).toBeInTheDocument();
  });

  it("hides the rolling visual figure from assistive tech and reserves width with tabular-nums", () => {
    render(<AnimatedNumber value={7} />);

    const visual = document.querySelector('[aria-hidden="true"]');
    expect(visual).toBeInTheDocument();
    expect(visual).toHaveClass("tabular-nums");
  });

  it("rolls the visible figure to the new value on change", async () => {
    const { rerender } = render(<AnimatedNumber value={1} />);
    rerender(<AnimatedNumber value={9} />);

    await waitFor(() => {
      expect(
        screen.getByText("9", { selector: ".sr-only" }),
      ).toBeInTheDocument();
    });
  });

  it("jumps straight to the new value under reduced motion instead of springing", async () => {
    render(
      <MotionConfig reducedMotion="always">
        <AnimatedNumber value={42} />
      </MotionConfig>,
    );

    // No separate aria-hidden rolling figure under reduced motion: there is
    // nothing to roll, so there is nothing to hide from assistive tech.
    expect(
      document.querySelector('[aria-hidden="true"]'),
    ).not.toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
