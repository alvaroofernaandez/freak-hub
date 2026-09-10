import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CategoryActivityStat } from "@/features/profile/lib/activity-stats";
import { ActivitySection } from "./activity-section";

const STATS: CategoryActivityStat[] = [
  { category: "anime", completed: 3, inProgress: 1 },
  { category: "manga", completed: 0, inProgress: 0 },
  { category: "game", completed: 2, inProgress: 0 },
  { category: "film", completed: 0, inProgress: 0 },
  { category: "boardgame", completed: 0, inProgress: 0 },
  { category: "tcg", completed: 0, inProgress: 0 },
];

describe("ActivitySection", () => {
  it("shows a row per category by default", () => {
    render(<ActivitySection stats={STATS} />);

    expect(screen.getAllByTestId("activity-row")).toHaveLength(6);
  });

  it("shows the completed and in-progress counts, rolling via AnimatedNumber", () => {
    render(<ActivitySection stats={STATS} />);

    // AnimatedNumber exposes the true value through a `.sr-only` node,
    // separate from the `aria-hidden` rolling figure — this asserts the
    // figures are real `AnimatedNumber`s, not bare `{count}` text.
    expect(screen.getByText("3", { selector: ".sr-only" })).toBeInTheDocument();
    expect(screen.getByText("1", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("narrows to a single category when selected", async () => {
    const user = userEvent.setup();
    render(<ActivitySection stats={STATS} />);

    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(await screen.findByRole("option", { name: "Anime" }));

    expect(screen.getAllByTestId("activity-row")).toHaveLength(1);
  });

  it("shows an empty state instead of six zeroed-out rows when there is no activity at all", () => {
    const zeroStats: CategoryActivityStat[] = STATS.map((stat) => ({
      ...stat,
      completed: 0,
      inProgress: 0,
    }));
    render(<ActivitySection stats={zeroStats} />);

    expect(screen.getByText(/sin actividad todavía/i)).toBeInTheDocument();
    expect(screen.queryByTestId("activity-row")).not.toBeInTheDocument();
  });
});
