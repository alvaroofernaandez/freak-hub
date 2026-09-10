import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PendingLabel } from "./pending-label";

describe("PendingLabel", () => {
  it("shows the idle label when not pending", () => {
    render(
      <PendingLabel
        pending={false}
        idleLabel="Enviar invitación"
        pendingLabel="Enviando…"
      />,
    );

    expect(screen.queryByText("Enviando…")).not.toBeInTheDocument();
    expect(screen.getAllByText("Enviar invitación").length).toBeGreaterThan(0);
  });

  it("shows the pending label while pending", () => {
    render(
      <PendingLabel
        pending
        idleLabel="Enviar invitación"
        pendingLabel="Enviando…"
      />,
    );

    // Appears twice now: once in the visible cross-fading label, once in the
    // sr-only status region that announces it (see the test below).
    expect(screen.getAllByText("Enviando…").length).toBeGreaterThan(0);
  });

  it("announces the pending label to assistive tech through a persistently mounted, polite live region", () => {
    // The label swap is purely visual (a cross-fade between two `m.span`);
    // nothing told screen reader users the button had entered a pending
    // state. A live region carries the pending label, and stays *mounted*
    // across the pending/idle transition — only its text changes — because a
    // region inserted into the DOM after first paint is often never picked
    // up by the browser's live-region watcher. It uses `aria-live="polite"`
    // without `role="status"` (which implies `aria-live="polite"` on its
    // own) so it never collides with a form's own result region
    // (`<output>`, implicit `role="status"`) under a `getByRole("status")`
    // query.
    const { container, rerender } = render(
      <PendingLabel
        pending={false}
        idleLabel="Enviar invitación"
        pendingLabel="Enviando…"
      />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).not.toHaveAttribute("role", "status");
    expect(liveRegion?.textContent).toBe("");

    rerender(
      <PendingLabel
        pending
        idleLabel="Enviar invitación"
        pendingLabel="Enviando…"
      />,
    );

    // Same node, not a newly mounted one.
    const sameLiveRegion = container.querySelector('[aria-live="polite"]');
    expect(sameLiveRegion).toBe(liveRegion);
    expect(sameLiveRegion?.textContent).toBe("Enviando…");

    rerender(
      <PendingLabel
        pending={false}
        idleLabel="Enviar invitación"
        pendingLabel="Enviando…"
      />,
    );

    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "",
    );
  });

  it("reserves the idle label's width from a hidden copy, so the button never resizes when the label swaps", () => {
    render(
      <PendingLabel
        pending
        idleLabel="Enviar invitación"
        pendingLabel="Enviando…"
      />,
    );

    const reserved = screen.getByText("Enviar invitación", {
      selector: "[aria-hidden='true']",
    });
    expect(reserved).toBeInTheDocument();
  });
});
