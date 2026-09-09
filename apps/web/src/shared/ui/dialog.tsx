"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";

type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
  /** id of the element (usually an <h2>) inside `children` that names the dialog. */
  titleId: string;
  children: ReactNode;
  /** Tailwind width cap for the panel, e.g. "max-w-[560px]". */
  maxWidthClassName?: string;
  /** Extra classes for the panel, merged (last wins) over the default padding/gap. */
  panelClassName?: string;
};

/**
 * Every centered modal in the app. Built on Radix so focus trapping, the
 * portal, scroll locking, `aria-modal` and outside-click dismissal come from
 * one well-tested implementation instead of being hand-rolled per feature.
 *
 * The overlay is deliberately heavy (ground-deep at 85%): a modal should read
 * as the screen behind it being switched off, not tinted.
 *
 * Title and any close affordance stay with the caller via `children`, but the
 * caller must render the title element with `id={titleId}` so
 * `aria-labelledby` resolves.
 */
export function Dialog({
  isOpen,
  onClose,
  titleId,
  children,
  maxWidthClassName = "max-w-[640px]",
  panelClassName,
}: DialogProps) {
  // This dialog is controlled from the outside and has no RadixDialog.Trigger,
  // so Radix has no way to know what opened it. Remember it here and restore
  // focus on close, or a keyboard user is dropped back at the top of the page.
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement as HTMLElement | null;
    }
  }, [isOpen]);

  return (
    <RadixDialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          data-dialog-overlay
          className="fixed inset-0 z-50 bg-ground-deep/85 data-[state=open]:animate-dialog-overlay-in motion-reduce:animate-none"
        />
        <RadixDialog.Content
          aria-labelledby={titleId}
          // Radix does not set this itself; WAI-ARIA asks for it on a modal.
          aria-modal="true"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-2xl",
            "data-[state=open]:animate-dialog-panel-in motion-reduce:animate-none",
            maxWidthClassName,
            panelClassName,
          )}
        >
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
