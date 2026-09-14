import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { normalizeError } from "@/shared/errors/normalize-error";
import { ApiError } from "@/shared/lib/api-client";

// `RetryButton`, inside `ErrorState`, refreshes through the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import type { LibraryItem } from "@/features/library/lib/library-item";
import { HomeDashboard } from "./home-dashboard";

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "entry-1",
    workId: "work-1",
    title: "Una obra",
    category: "anime",
    status: "completed",
    progress: 0,
    progressTotal: null,
    rating: null,
    isFavourite: false,
    owned: false,
    note: null,
    year: null,
    season: null,
    source: "anilist",
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const IN_PROGRESS: LibraryItem[] = [
  item({
    id: "anime-hxh",
    title: "Hunter x Hunter (2011)",
    status: "in_progress",
    isFavourite: true,
    progress: 68,
    progressTotal: 148,
  }),
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
        inProgressItems={IN_PROGRESS}
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
        inProgressItems={IN_PROGRESS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(
      screen.getByText("Esto es lo que pasa en tu biblioteca"),
    ).toBeInTheDocument();
  });

  it("lists the entries in progress under the continue rail", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressItems={IN_PROGRESS}
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
        inProgressItems={IN_PROGRESS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    const rail = screen.getByTestId("continue-rail");
    expect(rail).toHaveClass("overflow-x-auto");
    expect(rail.className).not.toMatch(/\bgrid\b/);
  });

  it("cascades the continue cards in, each a beat after the last", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressItems={[
          IN_PROGRESS[0],
          item({
            id: "anime-frieren",
            title: "Frieren",
            status: "in_progress",
          }),
        ]}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    const cards = screen.getAllByTestId("continue-card");
    expect(cards[0]).toHaveClass("stagger-in");
    expect(cards[0].style.getPropertyValue("--i")).toBe("0");
    expect(cards[1].style.getPropertyValue("--i")).toBe("1");
  });

  it("does not show a +1 control on continue cards, since there is no action behind it yet", () => {
    // The "+1" looked pressable (bordered, padded like a button) but had no
    // onClick and no progress-update action existed to back it — a fake
    // affordance. Removed until that action is actually built.
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressItems={IN_PROGRESS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.queryByText("+1")).not.toBeInTheDocument();
  });

  it("shows the progress as a count and as a share of its total", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressItems={IN_PROGRESS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.getByTestId("continue-card-progress")).toHaveTextContent(
      "68 / 148 episodios",
    );
    expect(
      screen.getByRole("progressbar", { name: /progreso/i }),
    ).toHaveAttribute("aria-valuenow", "46");
  });

  it("draws no bar when the catalogue gives no total, rather than reading a count as a percentage", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressItems={[
          item({ id: "x", status: "in_progress", progress: 12 }),
        ]}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.getByTestId("continue-card-progress")).toHaveTextContent(
      "12 episodios",
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows the rail's own failure instead of claiming nothing is in progress", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressItems={[]}
        inProgressError={normalizeError(
          new ApiError("boom", 503, "service_unavailable"),
          {
            resource: "lo que tienes en curso",
            operation: "load",
            scope: "section",
          },
        )}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.queryByText(/nada en curso/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });

  it("says the rail is truncated, which a horizontal rail has no bottom edge to show", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressItems={IN_PROGRESS}
        inProgressHasMore
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.getByTestId("continue-rail-has-more")).toBeInTheDocument();
  });

  it("says nothing about truncation when the whole rail fits", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressItems={IN_PROGRESS}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(
      screen.queryByTestId("continue-rail-has-more"),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing is in progress", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressItems={[]}
        recommendations={RECOMMENDATIONS}
        activity={ACTIVITY}
      />,
    );

    expect(screen.getByText(/nada en curso/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ir a tu biblioteca/i }),
    ).toHaveAttribute("href", "/biblioteca");
  });

  it("lists pending recommendations with their reason and sender", () => {
    render(
      <HomeDashboard
        displayName="Ada Lovelace"
        inProgressItems={IN_PROGRESS}
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
        inProgressItems={IN_PROGRESS}
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
        inProgressItems={IN_PROGRESS}
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
        inProgressItems={IN_PROGRESS}
        recommendations={RECOMMENDATIONS}
        activity={[]}
      />,
    );

    expect(screen.getByText(/sin actividad reciente/i)).toBeInTheDocument();
  });
});
