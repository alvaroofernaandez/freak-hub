"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";

type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
  /** id of the element (usually an <h2>) inside `children` that names the dialog. */
  titleId: string;
  children: ReactNode;
  /** Tailwind width cap for the panel, e.g. "max-w-[560px]". Defaults to the #26 modal's width. */
  maxWidthClassName?: string;
  /** Extra classes for the panel, merged (last wins) over the default padding/gap. */
  panelClassName?: string;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
}

/**
 * Generic accessible dialog: fixed backdrop, centered panel, focus moved in on
 * open, Tab/Shift+Tab trapped inside, Escape closes and returns focus to
 * whatever had focus when the dialog opened. Extracted from
 * AddCategoryModalHost (add-category-modal.tsx, #26) so it can be reused
 * for any centered modal in the app instead of re-implementing this logic
 * per feature (#30).
 *
 * Hand-built rather than the native `<dialog>` + showModal(), for the same
 * reasons #26 documented: jsdom (this repo's test environment) has no
 * showModal() implementation, and a native `<dialog>`'s ::backdrop can't dim
 * page content the way some callers (e.g. the add-category modal) need.
 *
 * Title and any close affordance are left to the caller via `children` —
 * different dialogs style their header differently — but the caller must
 * render the title element with `id={titleId}` so `aria-labelledby` resolves.
 */
export function Dialog({
  isOpen,
  onClose,
  titleId,
  children,
  maxWidthClassName = "max-w-[640px]",
  panelClassName,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Captured before we move focus below, so it's still whatever triggered
    // the open (e.g. the button that was just clicked).
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = dialogRef.current;
    if (dialog) {
      getFocusableElements(dialog)[0]?.focus();
    }

    return () => {
      triggerRef.current?.focus();
      triggerRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = getFocusableElements(dialog);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "oklch(0.05 0.01 272 / 0.55)" }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className={cn(
          "mx-4 flex w-full flex-col gap-5 rounded-2xl border border-border bg-surface-raised p-[30px]",
          maxWidthClassName,
          panelClassName,
        )}
        style={{ boxShadow: "0 24px 60px -20px oklch(0.05 0.01 272 / 0.6)" }}
      >
        {children}
      </div>
    </div>
  );
}
