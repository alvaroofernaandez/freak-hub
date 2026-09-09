import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Moulding } from "./moulding";

describe("Moulding", () => {
  it("is decorative, so it stays out of the accessibility tree", () => {
    render(<Moulding />);

    expect(screen.getByTestId("moulding")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("carries one segment per category, in roster order", () => {
    render(<Moulding />);

    expect(screen.getAllByTestId("moulding-segment")).toHaveLength(6);
  });
});
