import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CategoryActivityStat } from "@/features/profile/lib/mock-activity";
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

  it("shows the completed and in-progress counts", () => {
    render(<ActivitySection stats={STATS} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("narrows to a single category when selected", async () => {
    const user = userEvent.setup();
    render(<ActivitySection stats={STATS} />);

    await user.selectOptions(screen.getByLabelText("Categoría"), "anime");

    expect(screen.getAllByTestId("activity-row")).toHaveLength(1);
  });
});
