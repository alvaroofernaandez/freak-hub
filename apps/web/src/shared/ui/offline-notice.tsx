"use client";

import { AnimatePresence, m } from "motion/react";
import { cn } from "@/shared/lib/cn";
import { useOfflineNoticeVisible } from "@/shared/lib/use-offline-notice-visible";
import { EXIT_RATIO } from "@/shared/motion/tokens";

const ENTER_TRANSITION = { duration: 0.18 };
const EXIT_TRANSITION = { duration: 0.18 * EXIT_RATIO };

/**
 * Global connectivity notice for the app shell (ADR-0014 §5: a persistent
 * banner, not a toast — there is no toast channel). Polite and
 * non-blocking: it never traps focus or covers content, and it never claims
 * data is wrong, only that it might be stale.
 *
 * Fixed to a single line (`truncate`) so its height stays the same 36px
 * `Navbar` expects when it offsets its own sticky header — see
 * `useOfflineNoticeVisible` and docs/states.md.
 */
export function OfflineNotice() {
  const { online, visible } = useOfflineNoticeVisible();

  return (
    <AnimatePresence>
      {visible ? (
        <m.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0, transition: ENTER_TRANSITION }}
          exit={{ opacity: 0, y: -6, transition: EXIT_TRANSITION }}
          className={cn(
            "flex h-9 items-center justify-center truncate px-4 text-center text-sm",
            online ? "bg-success-soft text-ink" : "bg-warning-soft text-ink",
          )}
        >
          {online
            ? "Conexión recuperada."
            : "Sin conexión. Lo que ves puede no estar al día."}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
