import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemberRowSkeleton } from "./member-row-skeleton";

describe("MemberRowSkeleton", () => {
  it("keeps the placeholder out of the accessibility tree", () => {
    const { container } = render(<MemberRowSkeleton />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("matches the real row's footprint, so nothing jumps when data lands", () => {
    const { container } = render(<MemberRowSkeleton />);

    // Same shell as MemberRow: rounded-xl border p-3.5 with a 48px avatar slot.
    expect(container.firstElementChild).toHaveClass("rounded-xl");
    expect(container.firstElementChild).toHaveClass("p-3.5");
    expect(screen.getByTestId("member-row-skeleton-avatar")).toHaveClass(
      "h-12",
      "w-12",
    );
  });

  it("stops pulsing for anyone who asked for less motion", () => {
    render(<MemberRowSkeleton />);

    expect(screen.getByTestId("member-row-skeleton-avatar")).toHaveClass(
      "motion-reduce:animate-none",
    );
  });
});
