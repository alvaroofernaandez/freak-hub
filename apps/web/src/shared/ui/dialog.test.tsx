import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";

function Harness({ maxWidthClassName }: { maxWidthClassName?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Abrir
      </button>
      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        titleId="dialog-title"
        maxWidthClassName={maxWidthClassName}
      >
        <h2 id="dialog-title">Título del diálogo</h2>
        <button type="button">Primero</button>
        <button type="button">Último</button>
      </Dialog>
    </div>
  );
}

describe("Dialog", () => {
  it("closes when the pointer lands outside the panel", async () => {
    const onClose = vi.fn();
    render(
      <Dialog isOpen onClose={onClose} titleId="t">
        <h2 id="t">Título</h2>
      </Dialog>,
    );

    const overlay = document.querySelector("[data-dialog-overlay]");
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay as Element);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("dims the page behind it, hard enough to read as switched off", async () => {
    render(
      <Dialog isOpen onClose={() => {}} titleId="t">
        <h2 id="t">Título</h2>
      </Dialog>,
    );

    const overlay = document.querySelector("[data-dialog-overlay]");
    expect(overlay?.className).toMatch(/bg-ground-deep\/[89]\d/);
  });

  it("renders nothing while closed", () => {
    render(<Harness />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders as an accessible dialog labelled by titleId when open", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Abrir" }));

    const dialog = screen.getByRole("dialog", { name: "Título del diálogo" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("applies the given max-width class name to the dialog panel", async () => {
    const user = userEvent.setup();
    render(<Harness maxWidthClassName="max-w-[560px]" />);

    await user.click(screen.getByRole("button", { name: "Abrir" }));

    expect(screen.getByRole("dialog")).toHaveClass("max-w-[560px]");
  });

  it("moves focus into the dialog as soon as it opens", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Abrir" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("closes on Escape and returns focus to the element that opened it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await user.click(trigger);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Radix restores focus on the close transition, not synchronously.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("traps Tab so it cycles from the last focusable element back to the first", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));

    const focusable = screen.getAllByRole("button", {
      name: /^(Primero|Último)$/,
    });
    focusable[focusable.length - 1].focus();

    await user.tab();

    expect(focusable[0]).toHaveFocus();
  });

  it("traps Shift+Tab so it cycles from the first focusable element back to the last", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));

    const focusable = screen.getAllByRole("button", {
      name: /^(Primero|Último)$/,
    });
    focusable[0].focus();

    await user.tab({ shift: true });

    expect(focusable[focusable.length - 1]).toHaveFocus();
  });
});
