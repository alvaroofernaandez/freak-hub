import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MockActivityEvent } from "@/features/activity/lib/mock-activity-feed";
import { ActivityFeed } from "./activity-feed";

const EVENTS: MockActivityEvent[] = [
  {
    id: "act-1",
    actorUsername: "edward",
    text: "terminó Fullmetal Alchemist: Brotherhood",
    timestamp: "2026-09-05T10:20:00.000Z",
  },
  {
    id: "act-2",
    actorUsername: "killua",
    text: "marcó Wingspan como favorito",
    timestamp: "2026-09-04T18:05:00.000Z",
  },
];

describe("ActivityFeed", () => {
  it("links each event to its author's profile", () => {
    render(<ActivityFeed events={EVENTS} />);

    expect(screen.getByRole("link", { name: "Edward Elric" })).toHaveAttribute(
      "href",
      "/miembros/edward",
    );
    expect(
      screen.getByRole("link", { name: "Killua Zoldyck" }),
    ).toHaveAttribute("href", "/miembros/killua");
  });

  it("shows the event text", () => {
    render(<ActivityFeed events={EVENTS} />);

    expect(
      screen.getByText("terminó Fullmetal Alchemist: Brotherhood"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("marcó Wingspan como favorito"),
    ).toBeInTheDocument();
  });

  it("shows each timestamp as a monospace, machine-readable <time>", () => {
    const { container } = render(<ActivityFeed events={EVENTS} />);
    const times = container.querySelectorAll("time");

    expect(times).toHaveLength(EVENTS.length);
    expect(times[0]).toHaveAttribute("dateTime", EVENTS[0].timestamp);
    expect(times[0]).toHaveClass("font-mono");
  });

  it("renders events in the order given, most recent first", () => {
    render(<ActivityFeed events={EVENTS} />);
    const items = screen.getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("Edward Elric");
    expect(items[1]).toHaveTextContent("Killua Zoldyck");
  });
});
