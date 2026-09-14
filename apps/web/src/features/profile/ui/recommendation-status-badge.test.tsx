import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendationStatusBadge } from "./recommendation-status-badge";

describe("RecommendationStatusBadge", () => {
  it("labels every status in words, never colour alone", () => {
    const { rerender } = render(<RecommendationStatusBadge status="pending" />);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();

    rerender(<RecommendationStatusBadge status="accepted" />);
    expect(screen.getByText("Aceptada")).toBeInTheDocument();

    rerender(<RecommendationStatusBadge status="dismissed" />);
    expect(screen.getByText("Descartada")).toBeInTheDocument();
  });

  it("pairs each label with an icon, hidden from assistive tech", () => {
    render(<RecommendationStatusBadge status="pending" />);

    const mark = screen.getByTestId("recommendation-status-mark");
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark.querySelector("svg")).not.toBeNull();
  });

  it("gives each status its own icon, so they never read alike", () => {
    const marks = new Set<string>();

    for (const status of ["pending", "accepted", "dismissed"] as const) {
      const { unmount } = render(<RecommendationStatusBadge status={status} />);
      marks.add(screen.getByTestId("recommendation-status-mark").innerHTML);
      unmount();
    }

    expect(marks.size).toBe(3);
  });
});
