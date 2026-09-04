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

const STATUSES: Record<EntryStatus, { icon: string; label: string }> = {
  wishlist: { icon: "☆", label: "Wishlist" },
  pending: { icon: "○", label: "Pendiente" },
  in_progress: { icon: "◐", label: "En curso" },
  completed: { icon: "●", label: "Terminado" },
  dropped: { icon: "✕", label: "Abandonado" },
  on_hold: { icon: "❚❚", label: "En pausa" },
};

/** The six statuses, in their canonical order, for anything that lists them (e.g. filters). */
export const STATUS_ORDER: { status: EntryStatus; icon: string; label: string }[] =
  (Object.keys(STATUSES) as EntryStatus[]).map((status) => ({
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
  const { icon, label } = STATUSES[status];

  return (
    <span
      data-testid="status-badge"
      className="inline-flex items-center gap-1.5 text-sm text-ink"
    >
      <span data-testid="status-badge-icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
}
