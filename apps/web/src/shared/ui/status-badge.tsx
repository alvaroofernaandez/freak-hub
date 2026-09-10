"use client";

import { useEffect, useRef, useState } from "react";
import type { IconComponent } from "reicon-react";
import { Check, Clock, Pause, Play, Star, X } from "reicon-react";
import { StatusMark } from "./status-mark";

/**
 * No contract type exists for LibraryEntry yet (Work is not implemented), so
 * this union lives local to the component until then.
 */
export type EntryStatus =
  | "wishlist"
  | "pending"
  | "in_progress"
  | "completed"
  | "dropped"
  | "on_hold";

/**
 * One icon per status, chosen so the shape says what the word says: a star for
 * something wished for, a clock for something waiting its turn, play for what
 * is underway, a check for what is finished, a cross for what was abandoned
 * and a pause for what is on hold.
 */
const STATUSES: Record<EntryStatus, { Icon: IconComponent; label: string }> = {
  wishlist: { Icon: Star, label: "Wishlist" },
  pending: { Icon: Clock, label: "Pendiente" },
  in_progress: { Icon: Play, label: "En curso" },
  completed: { Icon: Check, label: "Terminado" },
  dropped: { Icon: X, label: "Abandonado" },
  on_hold: { Icon: Pause, label: "En pausa" },
};

/** The six statuses, in their canonical order, for anything that lists them (e.g. filters). */
export const STATUS_ORDER: {
  status: EntryStatus;
  Icon: IconComponent;
  label: string;
}[] = (Object.keys(STATUSES) as EntryStatus[]).map((status) => ({
  status,
  ...STATUSES[status],
}));

type StatusBadgeProps = {
  status: EntryStatus;
};

/**
 * A library entry's status: icon + label, never color (docs/design.md) —
 * color is already spent on category.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const { Icon, label } = STATUSES[status];
  const previousStatus = useRef(status);
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    // Only a real change earns the pop. Mounting is not a change: without this
    // guard every card in a list would pop on first paint.
    if (previousStatus.current === status) {
      return;
    }

    previousStatus.current = status;
    setPopped(true);
  }, [status]);

  return (
    <StatusMark
      Icon={Icon}
      label={label}
      testId="status-badge"
      className="text-sm text-ink"
      iconTestId="status-badge-icon"
      iconClassName="data-[pop]:animate-status-pop motion-reduce:animate-none"
      iconDataPop={popped}
      onIconAnimationEnd={() => setPopped(false)}
    />
  );
}
