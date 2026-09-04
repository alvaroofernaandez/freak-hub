import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MockRecommendation } from "@/features/profile/lib/mock-recommendations";
import { RecommendationsSection } from "./recommendations-section";

const RECOMMENDATIONS: MockRecommendation[] = [
  {
    id: "1",
    fromUsername: "edward",
    toUsername: "alphonse",
    workTitle: "Fullmetal Alchemist",
    reason: "Porque sí.",
    status: "pending",
  },
  {
    id: "2",
    fromUsername: "gon",
    toUsername: "edward",
    workTitle: "Hunter x Hunter",
    reason: "Porque también sí.",
    status: "accepted",
  },
];

describe("RecommendationsSection", () => {
  it("shows the work title and reason for each recommendation", () => {
    render(
      <RecommendationsSection
        recommendations={RECOMMENDATIONS}
        ownerUsername="edward"
      />,
    );

    expect(screen.getByText("Fullmetal Alchemist")).toBeInTheDocument();
    expect(screen.getByText("Porque sí.")).toBeInTheDocument();
    expect(screen.getByText("Hunter x Hunter")).toBeInTheDocument();
    expect(screen.getByText("Porque también sí.")).toBeInTheDocument();
  });

  it("marks a recommendation sent by the owner as sent, with its recipient", () => {
    render(
      <RecommendationsSection
        recommendations={RECOMMENDATIONS}
        ownerUsername="edward"
      />,
    );

    expect(screen.getByText(/enviada a @alphonse/i)).toBeInTheDocument();
  });

  it("marks a recommendation received by the owner as received, with its sender", () => {
    render(
      <RecommendationsSection
        recommendations={RECOMMENDATIONS}
        ownerUsername="edward"
      />,
    );

    expect(screen.getByText(/recibida de @gon/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no recommendations", () => {
    render(
      <RecommendationsSection recommendations={[]} ownerUsername="edward" />,
    );

    expect(screen.getByText(/sin recomendaciones/i)).toBeInTheDocument();
  });
});
