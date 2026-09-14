import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Recommendation } from "@/features/profile/lib/recommendation";
import { RecommendationsView } from "./recommendations-view";

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-1",
    fromUsername: "gon",
    toUsername: "alvaro",
    workTitle: "Hunter x Hunter",
    reason: "El arco de la hormiga quimera.",
    status: "pending",
  },
  {
    id: "rec-2",
    fromUsername: "killua",
    toUsername: "alvaro",
    workTitle: "Monster",
    reason: "Ya la viste y te gustó, esta es del mismo autor.",
    status: "accepted",
  },
  {
    id: "rec-3",
    fromUsername: "alvaro",
    toUsername: "gon",
    workTitle: "Steins;Gate",
    reason: "Te va a costar la primera mitad. Aguanta.",
    status: "dismissed",
  },
];

function sectionNamed(name: RegExp) {
  return screen.getByRole("region", { name });
}

describe("RecommendationsView", () => {
  it("puts in the inbox only what you received and have not answered", () => {
    render(
      <RecommendationsView
        recommendations={RECOMMENDATIONS}
        viewerUsername="alvaro"
      />,
    );

    const received = sectionNamed(/recibidas pendientes/i);
    expect(within(received).getByText("Hunter x Hunter")).toBeInTheDocument();
    expect(within(received).queryByText("Monster")).not.toBeInTheDocument();
    expect(within(received).queryByText("Steins;Gate")).not.toBeInTheDocument();
  });

  /**
   * The page asserts this too, but against an empty list, where it only
   * proves the empty states render no buttons. With rows on screen it is the
   * real guard: no endpoint answers an accept or a dismiss yet, and a control
   * that does nothing is worse than no control.
   */
  it("offers no accept or dismiss action on a populated screen", () => {
    render(
      <RecommendationsView
        recommendations={RECOMMENDATIONS}
        viewerUsername="alvaro"
      />,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("puts in the outbox everything you sent, whatever happened to it", () => {
    render(
      <RecommendationsView
        recommendations={RECOMMENDATIONS}
        viewerUsername="alvaro"
      />,
    );

    const sent = sectionNamed(/enviadas/i);
    expect(within(sent).getByText("Steins;Gate")).toBeInTheDocument();
    expect(within(sent).getByText("Descartada")).toBeInTheDocument();
  });

  it("keeps the state off the inbox, where every row says the same word", () => {
    render(
      <RecommendationsView
        recommendations={RECOMMENDATIONS}
        viewerUsername="alvaro"
      />,
    );

    const received = sectionNamed(/recibidas pendientes/i);
    expect(
      within(received).queryByTestId("recommendation-status-mark"),
    ).not.toBeInTheDocument();
  });

  it("counts each section next to its heading", () => {
    render(
      <RecommendationsView
        recommendations={RECOMMENDATIONS}
        viewerUsername="alvaro"
      />,
    );

    const received = sectionNamed(/recibidas pendientes/i);
    const sent = sectionNamed(/enviadas/i);
    expect(
      within(received).getByTestId("section-heading-count"),
    ).toHaveTextContent("1");
    expect(within(sent).getByTestId("section-heading-count")).toHaveTextContent(
      "1",
    );
  });

  it("gives each empty section its own inline empty state", () => {
    render(
      <RecommendationsView recommendations={[]} viewerUsername="alvaro" />,
    );

    expect(
      within(sectionNamed(/recibidas pendientes/i)).getByText(
        /nada pendiente/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(sectionNamed(/enviadas/i)).getByText(/no has recomendado nada/i),
    ).toBeInTheDocument();
  });

  it("separates the two sections with the moulding", () => {
    render(
      <RecommendationsView recommendations={[]} viewerUsername="alvaro" />,
    );

    expect(screen.getAllByTestId("moulding").length).toBeGreaterThan(0);
  });
});
