"use client";

import { AnimatePresence, m } from "motion/react";
import { DURATION, EXIT_RATIO, variants } from "@/shared/motion/tokens";

type PendingLabelProps = {
  pending: boolean;
  idleLabel: string;
  pendingLabel: string;
};

const ENTER_TRANSITION = { duration: DURATION.fast };
const EXIT_TRANSITION = { duration: DURATION.fast * EXIT_RATIO };

/**
 * A submit button's label, cross-fading to its pending copy (e.g.
 * "Enviando…") instead of swapping instantly. The idle label is also
 * rendered invisibly, in normal flow, so the button reserves its width up
 * front: assumes the idle label is the longer of the two, true for every
 * button this is used in today.
 */
export function PendingLabel({
  pending,
  idleLabel,
  pendingLabel,
}: PendingLabelProps) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <span aria-hidden="true" className="invisible">
        {idleLabel}
      </span>
      {/* Screen reader users get no visual cross-fade to notice, so the
       * pending state is announced explicitly here. This node stays mounted
       * across the pending/idle transition — only its text changes — rather
       * than being inserted on the fly: a live region that only appears in
       * the DOM once `pending` flips true is, in practice, often missed by
       * the browser's live-region watcher, since it only starts observing a
       * node that was already present. `aria-live="polite"` without
       * `role="status"` (which implies its own `aria-live="polite"`) keeps
       * this from colliding with a form's own result region (an `<output>`,
       * implicit `role="status"`) under a plain `getByRole("status")`
       * query. */}
      <span aria-live="polite" className="sr-only">
        {pending ? pendingLabel : ""}
      </span>
      <AnimatePresence initial={false}>
        <m.span
          key={pending ? "pending" : "idle"}
          className="absolute inset-0 flex items-center justify-center"
          initial={variants.fadeSwap.hidden}
          animate={{ ...variants.fadeSwap.shown, transition: ENTER_TRANSITION }}
          exit={{ ...variants.fadeSwap.exit, transition: EXIT_TRANSITION }}
        >
          {pending ? pendingLabel : idleLabel}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
