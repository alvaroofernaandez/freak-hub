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

const { InvitationForm } = await import("./invitation-form");

describe("InvitationForm", () => {
  beforeEach(() => {
    createInvitation.mockReset();
  });

  it("reports an error with the danger token, not a raw Tailwind color", async () => {
    createInvitation.mockResolvedValue({
      status: "error",
      message: "No se ha podido enviar la invitación.",
    });

    render(<InvitationForm />);
    await userEvent.type(screen.getByLabelText(/correo/i), "amigo@correo.com");
    await userEvent.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );

    // Interrupts on purpose: it only appears as the direct result of the
    // submit that just happened (docs/states.md, InlineMessage).
    const message = await screen.findByRole("alert");
    expect(message).toHaveClass("text-danger");
    expect(message).not.toHaveClass("text-red-400");
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya hay una invitación pendiente para ese correo.",
    );
  });

  it("ties a field error to the email field, focuses it, and skips the form-level message", async () => {
    createInvitation.mockResolvedValue({
      status: "error",
      message: "Escribe un correo válido.",
      fieldErrors: [{ field: "email", message: "Escribe un correo válido." }],
    });

    render(<InvitationForm />);
    const field = screen.getByLabelText(/correo/i);
    await userEvent.type(field, "amigo@correo.com");
    await userEvent.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Escribe un correo válido.");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.getAttribute("aria-describedby")).toContain(error.id);
    await waitFor(() => expect(field).toHaveFocus());
  });

  it("keeps what was typed after a failed submit", async () => {
    createInvitation.mockResolvedValue({
      status: "error",
      message: "No se ha podido enviar la invitación.",
    });

    render(<InvitationForm />);
    const field = screen.getByLabelText(/correo/i);
    await userEvent.type(field, "amigo@correo.com");
    await userEvent.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );
    await screen.findByRole("alert");

    expect(field).toHaveValue("amigo@correo.com");
  });
});
