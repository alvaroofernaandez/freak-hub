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

const { InvitePopover } = await import("./invite-popover");

describe("InvitePopover", () => {
  beforeEach(() => {
    createInvitation.mockReset();
    refresh.mockClear();
  });

  it("keeps the panel shut until the trigger is used", () => {
    render(<InvitePopover />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /invitar/i }),
    ).toBeInTheDocument();
  });

  it("opens a labelled panel with an accessible, autofocused email field", async () => {
    const user = userEvent.setup();
    render(<InvitePopover />);

    await user.click(screen.getByRole("button", { name: /^invitar$/i }));

    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAccessibleName(/invitar a alguien/i);
    const field = screen.getByLabelText(/correo/i);
    expect(field).toHaveAttribute("type", "email");
    await waitFor(() => expect(field).toHaveFocus());
  });

  it("never hides the trigger itself while it still owns focus: Radix's modal popover already hides the rest of the page for assistive tech", async () => {
    // The trigger is the `document.activeElement` for a tick when the panel
    // opens (before autofocus moves into the email field). Marking the
    // currently-focused element `aria-hidden` is an ARIA violation assistive
    // tech does not recover from consistently. `Popover.Root modal` already
    // calls `hideOthers` on everything outside the portaled panel, so a
    // manual `aria-hidden`/`tabIndex` on the trigger was both redundant and
    // unsafe.
    const user = userEvent.setup();
    render(<InvitePopover />);

    const trigger = screen.getByRole("button", { name: /^invitar$/i });
    await user.click(trigger);

    expect(trigger).not.toHaveAttribute("aria-hidden");
    expect(trigger).not.toHaveAttribute("tabindex");
  });

  it("closes on Escape without sending anything", async () => {
    const user = userEvent.setup();
    render(<InvitePopover />);

    await user.click(screen.getByRole("button", { name: /^invitar$/i }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it("shows a success confirmation with the sent email, and refreshes the roster behind it", async () => {
    createInvitation.mockResolvedValue({
      status: "success",
      message: "Invitación enviada a amigo@correo.com.",
    });
    const user = userEvent.setup();
    render(<InvitePopover />);

    await user.click(screen.getByRole("button", { name: /^invitar$/i }));
    await user.type(screen.getByLabelText(/correo/i), "amigo@correo.com");
    await user.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );

    expect(await screen.findByText(/invitación enviada/i)).toBeInTheDocument();
    expect(screen.getByText("amigo@correo.com")).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("stays open after a successful send, with the field cleared and ready for another invite — no auto-close timer", async () => {
    // The panel used to auto-close 1.4s after a success. Closing on success
    // makes a second invitation cost a full reopen, which is the common case
    // (see the InviteMemberDialog this replaced): it must stay open instead.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    createInvitation.mockResolvedValue({
      status: "success",
      message: "Invitación enviada a amigo@correo.com.",
    });
    const user = userEvent.setup();
    render(<InvitePopover />);

    await user.click(screen.getByRole("button", { name: /^invitar$/i }));
    const field = screen.getByLabelText(/correo/i);
    await user.type(field, "amigo@correo.com");
    await user.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );
    await screen.findByText(/invitación enviada/i);

    await vi.advanceTimersByTimeAsync(5000);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(field).toHaveValue("");
    vi.useRealTimers();
  });

  it("reports a failure inline, with the danger token, and does not refresh", async () => {
    createInvitation.mockResolvedValue({
      status: "error",
      message: "Ya hay una invitación pendiente para ese correo.",
    });
    const user = userEvent.setup();
    render(<InvitePopover />);

    await user.click(screen.getByRole("button", { name: /^invitar$/i }));
    await user.type(screen.getByLabelText(/correo/i), "amigo@correo.com");
    await user.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );

    const message = await screen.findByText(/ya hay una invitación pendiente/i);
    expect(message).toHaveClass("text-danger");
    expect(refresh).not.toHaveBeenCalled();
    // The panel stays open on error: nothing to confirm, the field is still
    // there to correct.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("ties a field error to the email field and keeps what was typed", async () => {
    createInvitation.mockResolvedValue({
      status: "error",
      message: "Ya hay una invitación pendiente para ese correo.",
      fieldErrors: [
        {
          field: "email",
          message: "Ya hay una invitación pendiente para ese correo.",
        },
      ],
    });
    const user = userEvent.setup();
    render(<InvitePopover />);

    await user.click(screen.getByRole("button", { name: /^invitar$/i }));
    const field = screen.getByLabelText(/correo/i);
    await user.type(field, "amigo@correo.com");
    await user.click(
      screen.getByRole("button", { name: /enviar invitación/i }),
    );

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Ya hay una invitación pendiente");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.getAttribute("aria-describedby")).toContain(error.id);
    expect(field).toHaveValue("amigo@correo.com");
  });
});
