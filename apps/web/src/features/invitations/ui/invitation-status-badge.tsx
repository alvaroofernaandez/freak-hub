import type { IconComponent } from "reicon-react";
import { Check, Clock, Forbidden } from "reicon-react";
import type { InvitationStatus } from "@/shared/api/types";

/**
 * Marks reuse the vocabulary `StatusBadge` already established for library
 * entries: a circle outline for what is still open, a filled circle for what
 * closed well, a cross for what was called off.
 */
const STATUSES: Record<
  InvitationStatus,
  { Icon: IconComponent; label: string }
> = {
  pending: { Icon: Clock, label: "Pendiente" },
  accepted: { Icon: Check, label: "Aceptada" },
  revoked: { Icon: Forbidden, label: "Revocada" },
};

/**
 * The state of an invitation: mark plus word, never colour on its own
 * (docs/design.md#el-estado-de-una-entrada-no-usa-color). Colour is already
 * spent identifying categories, and an invitation's state has to survive both
 * a colour-blind reader and a greyscale screenshot.
 */
export function InvitationStatusBadge({
  status,
}: {
  status: InvitationStatus;
}) {
  const { Icon, label } = STATUSES[status];

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-muted">
      <span
        data-testid="invitation-status-mark"
        aria-hidden="true"
        className="inline-flex"
      >
        <Icon size={14} />
      </span>
      {label}
    </span>
  );
}
