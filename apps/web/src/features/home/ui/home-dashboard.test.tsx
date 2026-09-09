import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Work } from "@/features/library/lib/work";
import { HomeDashboard } from "./home-dashboard";

const IN_PROGRESS_WORKS: Work[] = [
  {
    id: "anime-hxh",
    title: "Hunter x Hunter (2011)",
    category: "anime",
    status: "in_progress",
    isFavourite: true,
  },
];

const RECOMMENDATIONS = [
  {
    id: "rec-1",
    workTitle: "Frieren",
    fromUsername: "edward",
    reason: "Por el ritmo pausado.",
  },
];

const ACTIVITY = [{ id: "act-1", text: "@edward terminó Frieren" }];

describe("HomeDashboard", () => {
  it("greets the user by their display name", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressWorks={IN_PROGRESS_WORKS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Hola, Ada Lovelace" }),
    ).toBeInTheDocument();
  });

  it("shows the library subtitle under the greeting", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressWorks={IN_PROGRESS_WORKS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(
      screen.getByText("Esto es lo que pasa en tu biblioteca"),
    ).toBeInTheDocument();
  });

  it("lists the works in progress under the continue rail", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressWorks={IN_PROGRESS_WORKS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Sigue donde lo dejaste" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hunter x Hunter (2011)")).toBeInTheDocument();
  });

  it("renders the continue rail as a horizontal scroll, not a grid", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressWorks={IN_PROGRESS_WORKS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    const rail = screen.getByTestId("continue-rail");
    expect(rail).toHaveClass("overflow-x-auto");
    expect(rail.className).not.toMatch(/\bgrid\b/);
  });

  it("shows an empty state when nothing is in progress", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressWorks={[]}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.getByText(/nada en curso/i)).toBeInTheDocument();
  });

  it("lists pending recommendations with their reason and sender", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressWorks={IN_PROGRESS_WORKS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.getByText("Frieren")).toBeInTheDocument();
    expect(screen.getByText(/de @edward/)).toBeInTheDocument();
    expect(screen.getByText("Por el ritmo pausado.")).toBeInTheDocument();
  });

  it("lists recent activity entries", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressWorks={IN_PROGRESS_WORKS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.getByText("@edward terminó Frieren")).toBeInTheDocument();
  });

  it("shows an empty state when there are no pending recommendations", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressWorks={IN_PROGRESS_WORKS}
        recommendations={[]}
        activity={ACTIVITY}
      />,
    );

    expect(
      screen.getByText(/sin recomendaciones pendientes/i),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there is no recent activity", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressWorks={IN_PROGRESS_WORKS}
        recommendations={RECOMMENDATIONS}
        activity={[]}
      />,
    );

    expect(screen.getByText(/sin actividad reciente/i)).toBeInTheDocument();
  });
});
