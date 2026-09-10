"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { X } from "reicon-react";
import { cn } from "@/shared/lib/cn";
import { useMediaQuery } from "@/shared/lib/use-media-query";
import { CategoryCard } from "./category-card";
import { CATEGORY_ORDER, type CategoryId } from "./category-stripe";
import { Dialog } from "./dialog";
import { Drawer } from "./drawer";

/** Tailwind's `sm` breakpoint: `Dialog` at and above it, `Drawer` below. */
const WIDE_VIEWPORT_QUERY = "(min-width: 640px)";

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
 * page content) so it drops out of assistive tech and out of pointer reach
 * while the modal is open.
 *
 * The dimming itself belongs to the `Dialog` overlay. Fading this wrapper as
 * well stacked a second dim on top of the overlay and blacked the page out.
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
        isOpen && "pointer-events-none",
      )}
    >
      {children}
    </div>
  );
}

/** Long enough to read as confirmation, short enough not to feel like lag. */
const CONFIRM_FLASH_MS = 180;

type AddCategoryModalBodyProps = {
  titleId: string;
  dismiss: () => void;
  confirming: CategoryId | null;
  selectCategory: (category: CategoryId) => void;
};

/**
 * The picker's content: title, close control and the roster grid. Shared
 * between `Dialog` (sm and above) and `Drawer` (below sm, ADR-0013) — one
 * content component, two containers, so a breakpoint change is the only
 * difference between them (docs/design.md).
 */
function AddCategoryModalBody({
  titleId,
  dismiss,
  confirming,
  selectCategory,
}: AddCategoryModalBodyProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-[19px] font-bold text-ink">
          ¿Qué quieres añadir?
        </h2>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={dismiss}
          className={cn(
            "-mr-2.5 inline-flex size-11 items-center justify-center rounded-lg text-ink-muted",
            "transition-[color,background-color,transform] duration-150 ease-out-quint hover:bg-surface-raised hover:text-ink",
            "motion-reduce:transition-none",
          )}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div
        data-testid="add-category-modal-grid"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {CATEGORY_ORDER.map((category) => (
          <CategoryCard
            key={category}
            category={category}
            size="compact"
            selected={confirming === category}
            onSelect={() => selectCategory(category)}
          />
        ))}
      </div>
    </>
  );
}

/**
 * The modal itself: the same roster of character cards as the library lobby,
 * wrapped in `Dialog` (dialog.tsx, #30) at `sm` and above, or in `Drawer`
 * (drawer.tsx, ADR-0013) below it — a bottom sheet sits in the thumb zone on
 * a phone, where a centered dialog does not. Rendered once in the app shell;
 * its containers mount their content only while open.
 */
export function AddCategoryModalHost() {
  const { isOpen, close } = useAddCategoryModal();
  const router = useRouter();
  const titleId = useId();
  const [confirming, setConfirming] = useState<CategoryId | null>(null);
  const pendingNavigation = useRef<number | null>(null);
  // Defaults to `true` (the `Dialog` path) so environments without
  // `matchMedia` — this component mounts unconditionally in the app shell,
  // so that includes every test that never touches this behaviour — keep
  // today's Dialog-only behaviour instead of silently switching to Drawer.
  const isWideViewport = useMediaQuery(WIDE_VIEWPORT_QUERY, true);

  // The host stays mounted in the app shell, so a pending flash outlives the
  // dialog unless it is cancelled: dismissing the picker mid-flash must not
  // navigate a beat later.
  const dismiss = useCallback(() => {
    if (pendingNavigation.current !== null) {
      window.clearTimeout(pendingNavigation.current);
      pendingNavigation.current = null;
    }
    setConfirming(null);
    close();
  }, [close]);

  useEffect(
    () => () => {
      if (pendingNavigation.current !== null) {
        window.clearTimeout(pendingNavigation.current);
      }
    },
    [],
  );

  function selectCategory(category: CategoryId) {
    // A second tap during the flash would queue a second navigation.
    if (confirming) {
      return;
    }

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
    pendingNavigation.current = window.setTimeout(() => {
      pendingNavigation.current = null;
      router.push(`/anadir/${category}`);
      close();
      setConfirming(null);
    }, CONFIRM_FLASH_MS);
  }

  const body = (
    <AddCategoryModalBody
      titleId={titleId}
      dismiss={dismiss}
      confirming={confirming}
      selectCategory={selectCategory}
    />
  );

  if (isWideViewport) {
    return (
      <Dialog
        isOpen={isOpen}
        onClose={dismiss}
        titleId={titleId}
        maxWidthClassName="max-w-[720px]"
      >
        {body}
      </Dialog>
    );
  }

  return (
    <Drawer isOpen={isOpen} onClose={dismiss} titleId={titleId}>
      {body}
    </Drawer>
  );
}
