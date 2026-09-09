import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvitationFormState } from "@/features/invitations/actions/create-invitation";

const createInvitation =
  vi.fn<
    (
      previous: InvitationFormState,
      formData: FormData,
    ) => Promise<InvitationFormState>
  >();
vi.mock("@/features/invitations/actions/create-invitation", () => ({
  createInvitation: (previous: InvitationFormState, formData: FormData) =>
    createInvitation(previous, formData),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { InviteMemberDialog } = await import("./invite-member-dialog");

describe("InviteMemberDialog", () => {
  beforeEach(() => {
    createInvitation.mockReset();
    refresh.mockClear();
  });

  it("keeps the dialog shut until the trigger is used", () => {
    render(<InviteMemberDialog />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /invitar/i }),
    ).toBeInTheDocument();
  });

  it("opens a labelled dialog with an accessible email field", async () => {
    const user = userEvent.setup();
    render(<InviteMemberDialog />);

    await user.click(screen.getByRole("button", { name: /invitar/i }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      /invitar a alguien/i,
    );
    expect(screen.getByLabelText(/correo/i)).toHaveAttribute("type", "email");
  });

  it("confirms the invitation and refreshes the roster behind it", async () => {
    createInvitation.mockResolvedValue({
      status: "success",
      message: "Invitación enviada a amigo@correo.com.",
    });
    const user = userEvent.setup();
    render(<InviteMemberDialog />);

    await user.click(screen.getByRole("button", { name: /invitar/i }));
    await user.type(screen.getByLabelText(/correo/i), "amigo@correo.com");
    await user.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Invitación enviada a amigo@correo.com.",
    );
    // The pending list behind the dialog has to show the new invitation.
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("reports a failure with the danger token and does not refresh", async () => {
    createInvitation.mockResolvedValue({
      status: "error",
      message: "Ya hay una invitación pendiente para ese correo.",
    });
    const user = userEvent.setup();
    render(<InviteMemberDialog />);

    await user.click(screen.getByRole("button", { name: /invitar/i }));
    await user.type(screen.getByLabelText(/correo/i), "amigo@correo.com");
    await user.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );

    const message = await screen.findByRole("status");
    expect(message).toHaveTextContent(
      "Ya hay una invitación pendiente para ese correo.",
    );
    expect(message).toHaveClass("text-danger");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("closes on the cancel action without sending anything", async () => {
    const user = userEvent.setup();
    render(<InviteMemberDialog />);

    await user.click(screen.getByRole("button", { name: /invitar/i }));
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createInvitation).not.toHaveBeenCalled();
  });
});
