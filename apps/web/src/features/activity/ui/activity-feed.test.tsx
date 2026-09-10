import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "@/features/activity/lib/activity-event";
import { ActivityFeed } from "./activity-feed";

const EVENTS: ActivityEvent[] = [
  {
    id: "act-1",
    actorUsername: "edward",
    actorDisplayName: "Edward Elric",
    text: "terminó Fullmetal Alchemist: Brotherhood",
    timestamp: "2026-09-05T10:20:00.000Z",
  },
  {
    id: "act-2",
    actorUsername: "killua",
    actorDisplayName: "Killua Zoldyck",
    text: "marcó Wingspan como favorito",
    timestamp: "2026-09-04T18:05:00.000Z",
  },
];

describe("ActivityFeed", () => {
  it("marks the actor link as clickable on hover", () => {
    render(
      <ActivityFeed
        events={[
          {
            id: "act-h",
            actorUsername: "gon",
            actorDisplayName: "Gon Freecss",
            text: "empezó Hunter x Hunter",
            timestamp: "2026-09-06T09:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Gon Freecss" })).toHaveClass(
      "hover:text-accent",
    );
  });

  it("marks each entry with an icon for its kind of event", () => {
    render(
      <ActivityFeed
        events={[
          {
            id: "act-r",
            actorUsername: "gon",
            type: "rating",
            text: "valoró Elden Ring con un 10",
            timestamp: "2026-09-06T09:00:00.000Z",
          },
          {
            id: "act-f",
            actorUsername: "killua",
            type: "favourite",
            text: "marcó Wingspan como favorito",
            timestamp: "2026-09-06T10:00:00.000Z",
          },
        ]}
      />,
    );

    const icons = screen.getAllByTestId("activity-event-icon");
    expect(icons).toHaveLength(2);
    // Decorative: the sentence next to it already says what happened.
    expect(icons[0]).toHaveAttribute("aria-hidden", "true");
    expect(icons[0]?.textContent).not.toBe(icons[1]?.textContent);
  });

  it("renders an entry with no known kind, without an icon", () => {
    render(
      <ActivityFeed
        events={[
          {
            id: "act-x",
            actorUsername: "gon",
            text: "hizo algo todavía sin tipo",
            timestamp: "2026-09-06T09:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.queryByTestId("activity-event-icon")).not.toBeInTheDocument();
    expect(screen.getByText(/hizo algo/)).toBeInTheDocument();
  });

  it("falls back to the handle when the actor has no display name", () => {
    render(
      <ActivityFeed
        events={[
          {
            id: "act-9",
            actorUsername: "gon",
            text: "empezó Hunter x Hunter",
            timestamp: "2026-09-06T09:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "gon" })).toHaveAttribute(
      "href",
      "/miembros/gon",
    );
  });

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

  it("cascades entries in, each a beat after the last", () => {
    render(<ActivityFeed events={EVENTS} />);
    const items = screen.getAllByRole("listitem");

    expect(items[0]).toHaveClass("stagger-in");
    expect(items[0].style.getPropertyValue("--i")).toBe("0");
    expect(items[1].style.getPropertyValue("--i")).toBe("1");
  });

  it("shows an empty state when there are no events yet", () => {
    render(<ActivityFeed events={[]} />);

    expect(screen.getByText(/sin actividad todavía/i)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
