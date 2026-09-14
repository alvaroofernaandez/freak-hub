import type { IconComponent } from "reicon-react";
import { Check, Clock, X } from "reicon-react";
import type { RecommendationStatus } from "@/features/profile/lib/recommendation";
import { StatusMark } from "@/shared/ui/status-mark";

/**
 * The same vocabulary `StatusBadge` and `InvitationStatusBadge` already
 * established: a clock for what is still waiting on someone, a check for what
 * closed well, a cross for what was turned down.
 */
const STATUSES: Record<
  RecommendationStatus,
  { Icon: IconComponent; label: string }
> = {
  pending: { Icon: Clock, label: "Pendiente" },
  accepted: { Icon: Check, label: "Aceptada" },
  dismissed: { Icon: X, label: "Descartada" },
};

/**
 * The state of a recommendation: mark plus word, never colour on its own
 * (docs/design.md#el-estado-de-una-entrada-no-usa-color). It composes the
 * shared `StatusMark` exactly as `InvitationStatusBadge` does rather than
 * inventing a badge of its own, which the extension criterion for screens
 * without a mockup forbids.
 */
export function RecommendationStatusBadge({
  status,
}: {
  status: RecommendationStatus;
}) {
  const { Icon, label } = STATUSES[status];

  return (
    <StatusMark
      Icon={Icon}
      label={label}
      className="font-mono text-xs text-ink-muted"
      iconTestId="recommendation-status-mark"
      iconSize={14}
    />
  );
}
