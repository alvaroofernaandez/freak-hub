"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useId, useState } from "react";
import { X } from "reicon-react";
import { cn } from "@/shared/lib/cn";
import {
  CATEGORY_ACCENT_CLASS,
  CATEGORY_COLOR_CLASS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategoryId,
} from "./category-stripe";
import { Dialog } from "./dialog";

type AddCategoryModalContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const AddCategoryModalContext = createContext<AddCategoryModalContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

/**
 * Holds whether the "add a work" category picker is open, so it can be
 * triggered from the navbar (any screen) and rendered once in the app shell
 * (docs/design/high-fidelity-desktop.html §5). Same pattern as
 * ActiveCategoryProvider: one context, several small consumers.
 *
 * Capturing/restoring focus around open and close used to live here; it now
 * lives in the generic `Dialog` (dialog.tsx, #30), so this provider only
 * tracks the open flag.
 */
export function AddCategoryModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <AddCategoryModalContext.Provider value={{ isOpen, open, close }}>
      {children}
    </AddCategoryModalContext.Provider>
  );
}

/** Read/trigger the add-category modal from anywhere below the provider. */
export function useAddCategoryModal(): AddCategoryModalContextValue {
  return useContext(AddCategoryModalContext);
}

type AddCategoryModalDimmerProps = { children: ReactNode };

/**
 * Wraps everything that sits behind the modal (navbar, category stripe,
 * page content) so it dims to opacity .32 and disappears from assistive
 * tech while the modal is open, matching the mockup's overlay treatment.
 */
export function AddCategoryModalDimmer({
  children,
}: AddCategoryModalDimmerProps) {
  const { isOpen } = useAddCategoryModal();

  return (
    <div
      data-testid="add-category-modal-dimmer"
      aria-hidden={isOpen ? true : undefined}
      className={cn(
        "flex min-h-dvh flex-1 flex-col",
        isOpen && "pointer-events-none opacity-[.32]",
      )}
    >
      {children}
    </div>
  );
}

/** Long enough to read as confirmation, short enough not to feel like lag. */
const CONFIRM_FLASH_MS = 180;

/**
 * The modal itself (docs/design/high-fidelity-desktop.html §5 · AÑADIR —
 * ELEGIR CATEGORÍA): the category grid, wrapped in the generic `Dialog`
 * (dialog.tsx, #30) for its backdrop/focus-trap/Escape behavior. Rendered
 * once in the app shell; mounts only while open.
 */
export function AddCategoryModalHost() {
  const { isOpen, close } = useAddCategoryModal();
  const router = useRouter();
  const titleId = useId();
  const [confirming, setConfirming] = useState<CategoryId | null>(null);

  function selectCategory(category: CategoryId) {
    const skipFlash =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    if (skipFlash) {
      router.push(`/anadir/${category}`);
      close();
      return;
    }

    // Show which category was chosen before the route changes: picking one is
    // rare enough to deserve the beat, and it confirms the tap was registered.
    setConfirming(category);
    window.setTimeout(() => {
      router.push(`/anadir/${category}`);
      close();
      setConfirming(null);
    }, CONFIRM_FLASH_MS);
  }

  return (
    <Dialog isOpen={isOpen} onClose={close} titleId={titleId}>
      <div className="flex items-baseline justify-between">
        <h2 id={titleId} className="text-[19px] font-bold text-ink">
          ¿Qué quieres añadir?
        </h2>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={close}
          className="text-[15px] text-ink-muted transition-opacity hover:opacity-80"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div
        data-testid="add-category-modal-grid"
        className="grid grid-cols-3 gap-[14px]"
      >
        {CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => selectCategory(category)}
            data-confirming={confirming === category || undefined}
            className={cn(
              "flex flex-col items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-[22px] text-center text-[13px] font-semibold text-ink",
              "transition-[transform,box-shadow,opacity] duration-150 ease-out hover:opacity-90",
              "motion-reduce:transition-none",
              confirming === category &&
                cn(
                  CATEGORY_ACCENT_CLASS[category],
                  "scale-105 ring-2 ring-current",
                ),
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-5 w-5 rounded-[6px]",
                CATEGORY_COLOR_CLASS[category],
              )}
            />
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>
    </Dialog>
  );
}
