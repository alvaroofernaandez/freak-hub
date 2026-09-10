"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { AnimatePresence, m } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";
import { DURATION, EASE_OUT_QUINT, EXIT_RATIO } from "@/shared/motion/tokens";

/** The dialog enters at `DURATION.fast` and exits at 75% of that, per ADR-0012. */
const ENTER_TRANSITION = { duration: DURATION.fast, ease: EASE_OUT_QUINT };
const EXIT_TRANSITION = {
  duration: DURATION.fast * EXIT_RATIO,
  ease: EASE_OUT_QUINT,
};

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
 * The overlay pushes the page back without switching it off: ground-deep at
 * 55% plus a light blur. You still see where you are, and whatever sits behind
 * (often the same cards the panel shows) is out of focus instead of competing.
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
      <AnimatePresence>
        {isOpen ? (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <m.div
                data-dialog-overlay
                className="fixed inset-0 z-50 bg-ground-deep/55 backdrop-blur-[6px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: ENTER_TRANSITION }}
                exit={{ opacity: 0, transition: EXIT_TRANSITION }}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content
              asChild
              forceMount
              aria-labelledby={titleId}
              // Radix does not set this itself; WAI-ARIA asks for it on a modal.
              aria-modal="true"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                openerRef.current?.focus();
              }}
            >
              <m.div
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-2xl",
                  maxWidthClassName,
                  panelClassName,
                )}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  transition: ENTER_TRANSITION,
                }}
                exit={{ opacity: 0, scale: 0.98, transition: EXIT_TRANSITION }}
              >
                {children}
              </m.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        ) : null}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
