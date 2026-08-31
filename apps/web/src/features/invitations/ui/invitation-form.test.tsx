import { render, screen } from "@testing-library/react";
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

const { InvitationForm } = await import("./invitation-form");

describe("InvitationForm", () => {
  beforeEach(() => {
    createInvitation.mockReset();
  });

  it("exposes an accessible email field wired to its label", () => {
    render(<InvitationForm />);

    expect(
      screen.getByLabelText(/correo de la persona a la que invitas/i),
    ).toHaveAttribute("type", "email");
  });

  it("reports back the message returned by the action", async () => {
    createInvitation.mockResolvedValue({
      status: "success",
      message: "Invitación enviada a amigo@correo.com.",
    });

    render(<InvitationForm />);
    await userEvent.type(screen.getByLabelText(/correo/i), "amigo@correo.com");
    await userEvent.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Invitación enviada a amigo@correo.com.",
    );
  });

  it("surfaces the action error message", async () => {
    createInvitation.mockResolvedValue({
      status: "error",
      message: "Ya hay una invitación pendiente para ese correo.",
    });

    render(<InvitationForm />);
    await userEvent.type(screen.getByLabelText(/correo/i), "amigo@correo.com");
    await userEvent.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Ya hay una invitación pendiente para ese correo.",
    );
  });
});
