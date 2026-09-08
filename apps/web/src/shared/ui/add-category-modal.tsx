"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/shared/lib/cn";
import {
  CATEGORY_COLOR_CLASS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategoryId,
} from "./category-stripe";

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
 */
export function AddCategoryModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
}

/**
 * The modal itself (docs/design/high-fidelity-desktop.html §5 · AÑADIR —
 * ELEGIR CATEGORÍA): a hand-built accessible dialog, not the native
 * `<dialog>` element, because jsdom in this repo has no `showModal()`
 * (verified with jsdom 30.0.1) and a native `<dialog>`'s `::backdrop` cannot
 * dim the page content behind it the way the mockup does. Rendered once in
 * the app shell; mounts only while open.
 */
export function AddCategoryModalHost() {
  const { isOpen, close } = useAddCategoryModal();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    getFocusableElements(dialog)[0]?.focus();
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function selectCategory(category: CategoryId) {
    router.push(`/anadir/${category}`);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
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
        className="mx-4 flex w-full max-w-[640px] flex-col gap-5 rounded-2xl border border-border bg-surface-raised p-[30px]"
        style={{ boxShadow: "0 24px 60px -20px oklch(0.05 0.01 272 / 0.6)" }}
      >
        <div className="flex items-baseline justify-between">
          <h2 id={titleId} className="text-[19px] font-bold text-ink">
            ¿Qué quieres añadir?
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={close}
            className="text-[15px] text-ink-faint transition-opacity hover:opacity-80"
          >
            ✕
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
              className="flex flex-col items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-[22px] text-center text-[13px] font-semibold text-ink transition-opacity hover:opacity-90"
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
      </div>
    </div>
  );
}
