import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvitationStatusBadge } from "./invitation-status-badge";

describe("InvitationStatusBadge", () => {
  it("labels every status in words, never colour alone", () => {
    const { rerender } = render(<InvitationStatusBadge status="pending" />);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();

    rerender(<InvitationStatusBadge status="accepted" />);
    expect(screen.getByText("Aceptada")).toBeInTheDocument();

    rerender(<InvitationStatusBadge status="revoked" />);
    expect(screen.getByText("Revocada")).toBeInTheDocument();
  });

  it("pairs each label with an icon, hidden from assistive tech", () => {
    render(<InvitationStatusBadge status="pending" />);

    const mark = screen.getByTestId("invitation-status-mark");
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark.querySelector("svg")).not.toBeNull();
  });

  it("gives each status its own icon, so they never read alike", () => {
    const marks = new Set<string>();

    for (const status of ["pending", "accepted", "revoked"] as const) {
      const { unmount } = render(<InvitationStatusBadge status={status} />);
      marks.add(screen.getByTestId("invitation-status-mark").innerHTML);
      unmount();
    }

    expect(marks.size).toBe(3);
  });
});
