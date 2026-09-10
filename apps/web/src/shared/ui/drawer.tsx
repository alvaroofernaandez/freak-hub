"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { Drawer as VaulDrawer } from "vaul";
import { cn } from "@/shared/lib/cn";

type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  /** id of the element (usually an <h2>) inside `children` that names the drawer. */
  titleId: string;
  children: ReactNode;
  /** Extra classes for the panel, merged (last wins) over the default padding/gap. */
  panelClassName?: string;
};

/**
 * The bottom-sheet counterpart to `Dialog` (dialog.tsx), for the primary
 * mobile action (ADR-0013): `AddCategoryModalHost` renders this instead of
 * `Dialog` below the `sm` breakpoint, with the same content either way.
 *
 * Built on `vaul`, which wraps `@radix-ui/react-dialog` internally, so focus
 * trapping, the portal, scroll locking and `aria-modal` come from the same
 * well-tested source `Dialog` uses — plus vaul's own drag-to-dismiss and
 * safe-area-aware snap-to-bottom behaviour, which `Dialog` has no reason to
 * implement.
 *
 * The overlay matches `Dialog`'s: `--color-ground-deep` at 55% with a 6px
 * blur, so switching between the two at the `sm` breakpoint (a resize, or a
 * device rotation) never reads as a different surface.
 */
export function Drawer({
  isOpen,
  onClose,
  titleId,
  children,
  panelClassName,
}: DrawerProps) {
  // Same reasoning as `Dialog`: this drawer is controlled from the outside
  // and has no `Drawer.Trigger`, so vaul/Radix has no way to know what
  // opened it. Remember it here and restore focus on close.
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement as HTMLElement | null;
    }
  }, [isOpen]);

  return (
    <VaulDrawer.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className="fixed inset-0 z-50 bg-ground-deep/55 backdrop-blur-[6px]" />
        <VaulDrawer.Content
          aria-labelledby={titleId}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-5 rounded-t-2xl border border-border bg-surface p-6 pt-3 outline-none",
            // Room for the home-indicator/gesture area on notched phones.
            "pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
            panelClassName,
          )}
        >
          <VaulDrawer.Handle className="mx-auto mb-1 !w-10 !bg-border-soft" />
          {children}
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
}
