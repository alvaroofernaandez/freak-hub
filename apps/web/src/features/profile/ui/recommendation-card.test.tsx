import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Recommendation } from "@/features/profile/lib/recommendation";
import { RecommendationCard } from "./recommendation-card";

const SENT: Recommendation = {
  id: "1",
  fromUsername: "edward",
  toUsername: "alphonse",
  workTitle: "Fullmetal Alchemist",
  reason: "Es literalmente nuestra historia.",
  status: "accepted",
};

const RECEIVED: Recommendation = {
  id: "2",
  fromUsername: "gon",
  toUsername: "edward",
  workTitle: "Hunter x Hunter",
  reason: "El arco de la hormiga quimera.",
  status: "pending",
};

function renderCard(props: Parameters<typeof RecommendationCard>[0]) {
  return render(
    <ul>
      <RecommendationCard {...props} />
    </ul>,
  );
}

describe("RecommendationCard", () => {
  it("shows the work and the reason, which is what a recommendation is", () => {
    renderCard({ recommendation: SENT, viewerUsername: "edward" });

    expect(screen.getByText("Fullmetal Alchemist")).toBeInTheDocument();
    expect(
      screen.getByText("Es literalmente nuestra historia."),
    ).toBeInTheDocument();
  });

  it("names the recipient when the viewer sent it", () => {
    renderCard({ recommendation: SENT, viewerUsername: "edward" });

    expect(screen.getByText(/enviada a @alphonse/i)).toBeInTheDocument();
  });

  it("names the sender when the viewer received it", () => {
    renderCard({ recommendation: RECEIVED, viewerUsername: "edward" });

    expect(screen.getByText(/recibida de @gon/i)).toBeInTheDocument();
  });

  it("sits in a list, so a screen reader announces how many there are", () => {
    renderCard({ recommendation: SENT, viewerUsername: "edward" });

    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  it("leaves the status out unless it is asked for", () => {
    renderCard({ recommendation: SENT, viewerUsername: "edward" });

    expect(screen.queryByText("Aceptada")).not.toBeInTheDocument();
  });

  it("shows the status as icon and word when it is asked for", () => {
    renderCard({
      recommendation: SENT,
      viewerUsername: "edward",
      showStatus: true,
    });

    expect(screen.getByText("Aceptada")).toBeInTheDocument();
    expect(
      screen.getByTestId("recommendation-status-mark"),
    ).toBeInTheDocument();
  });
});
