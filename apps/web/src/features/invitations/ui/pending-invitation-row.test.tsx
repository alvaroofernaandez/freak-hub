import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PendingInvitationRow } from "./pending-invitation-row";

describe("PendingInvitationRow", () => {
  it("shows the invited address and its state in words", () => {
    render(
      <PendingInvitationRow
        email="amigo@correo.com"
        status="pending"
        createdAt="2026-09-01T00:00:00.000Z"
      />,
    );

    expect(screen.getByText("amigo@correo.com")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it("credits who sent it when that is known", () => {
    render(
      <PendingInvitationRow
        email="amigo@correo.com"
        status="pending"
        createdAt="2026-09-01T00:00:00.000Z"
        invitedBy="Álvaro Fernández"
      />,
    );

    expect(screen.getByText(/álvaro fernández/i)).toBeInTheDocument();
  });

  it("omits the credit line when the inviter is unknown", () => {
    render(
      <PendingInvitationRow
        email="amigo@correo.com"
        status="pending"
        createdAt="2026-09-01T00:00:00.000Z"
      />,
    );

    expect(screen.queryByText(/invitada por/i)).not.toBeInTheDocument();
  });

  it("dates the invitation in a machine-readable time element", () => {
    render(
      <PendingInvitationRow
        email="amigo@correo.com"
        status="pending"
        createdAt="2026-09-01T00:00:00.000Z"
      />,
    );

    expect(screen.getByTestId("invitation-sent-at")).toHaveAttribute(
      "datetime",
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("reads as provisional: a dashed outline, not a solid member card", () => {
    const { container } = render(
      <PendingInvitationRow
        email="amigo@correo.com"
        status="pending"
        createdAt="2026-09-01T00:00:00.000Z"
      />,
    );

    expect(container.firstElementChild).toHaveClass("border-dashed");
  });
});
