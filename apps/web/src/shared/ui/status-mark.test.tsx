import { render, screen } from "@testing-library/react";
import { Check } from "reicon-react";
import { describe, expect, it, vi } from "vitest";
import { StatusMark } from "./status-mark";

describe("StatusMark", () => {
  it("pairs an icon, hidden from assistive tech, with its label in words", () => {
    render(<StatusMark Icon={Check} label="Terminado" iconTestId="mark" />);

    expect(screen.getByText("Terminado")).toBeInTheDocument();
    const icon = screen.getByTestId("mark");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon.querySelector("svg")).not.toBeNull();
  });

  it("never colours the mark on its own — no colour utility class", () => {
    render(<StatusMark Icon={Check} label="Terminado" iconTestId="mark" />);

    expect(screen.getByTestId("mark").className).not.toMatch(/text-\w+-\d/);
  });

  it("applies the outer testid and className when given", () => {
    render(
      <StatusMark
        Icon={Check}
        label="Terminado"
        testId="outer"
        className="font-mono text-xs"
      />,
    );

    const outer = screen.getByTestId("outer");
    expect(outer).toHaveClass("font-mono", "text-xs");
  });

  it("forwards data-pop and the animation-end handler to the icon wrapper", () => {
    const onEnd = vi.fn();
    render(
      <StatusMark
        Icon={Check}
        label="Terminado"
        iconTestId="mark"
        iconDataPop
        onIconAnimationEnd={onEnd}
      />,
    );

    const icon = screen.getByTestId("mark");
    expect(icon).toHaveAttribute("data-pop");
  });
});
