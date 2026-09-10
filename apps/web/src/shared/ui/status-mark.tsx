import type { IconComponent } from "reicon-react";
import { cn } from "@/shared/lib/cn";

interface StatusMarkProps {
  Icon: IconComponent;
  label: string;
  /** Outer wrapper — the whole mark + label row. */
  className?: string;
  testId?: string;
  iconSize?: number;
  /** The icon wrapper — where a caller's own animation classes go
   * (`StatusBadge`'s change-pop). */
  iconClassName?: string;
  iconTestId?: string;
  iconDataPop?: boolean;
  onIconAnimationEnd?: () => void;
}

/**
 * The mark-plus-label primitive every status indicator in the product
 * builds on (docs/design.md: state is icon and label, never colour alone —
 * colour already identifies the category). `StatusBadge` (library entries)
 * and `InvitationStatusBadge` (invitations) each keep their own icon set,
 * label vocabulary and sizing; only this shared shape and the
 * aria-hidden/label pairing live here.
 */
export function StatusMark({
  Icon,
  label,
  className,
  testId,
  iconSize = 16,
  iconClassName,
  iconTestId,
  iconDataPop,
  onIconAnimationEnd,
}: StatusMarkProps) {
  return (
    <span
      data-testid={testId}
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <span
        data-testid={iconTestId}
        aria-hidden="true"
        data-pop={iconDataPop || undefined}
        onAnimationEnd={onIconAnimationEnd}
        className={cn("inline-flex", iconClassName)}
      >
        <Icon size={iconSize} />
      </span>
      {label}
    </span>
  );
}
