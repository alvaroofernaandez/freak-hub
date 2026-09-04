import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MockWork } from "@/features/library/lib/mock-works";
import { HomeDashboard } from "./home-dashboard";

const IN_PROGRESS_WORKS: MockWork[] = [
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
  it("lists the works in progress", () => {
    render(
      <HomeDashboard
        inProgressWorks={IN_PROGRESS_WORKS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.getByText("Hunter x Hunter (2011)")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is in progress", () => {
    render(
      <HomeDashboard
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
        inProgressWorks={IN_PROGRESS_WORKS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.getByText("@edward terminó Frieren")).toBeInTheDocument();
  });
});
