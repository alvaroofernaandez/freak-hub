import Link from "next/link";
import { Avatar } from "@/features/members/ui/avatar";
import { cn } from "@/shared/lib/cn";

type MemberRowProps = {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  /** ISO 8601 timestamp of when they joined the group. */
  memberSince?: string | null;
  /** Marks the row as the reader's own. */
  isYou?: boolean;
};

/** "septiembre de 2023". The day adds nothing to how long someone has been here. */
function formatMonthAndYear(timestamp: string): string {
  return new Intl.DateTimeFormat("es", {
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

/** A member of the group, linking to their profile (docs/screens.md). */
export function MemberRow({
  username,
  displayName,
  avatarUrl,
  memberSince,
  isYou,
}: MemberRowProps) {
  return (
    <Link
      href={`/miembros/${username}`}
      className={cn(
        "flex items-center gap-3.5 rounded-xl border bg-surface-raised p-3.5",
        "transition-colors duration-150 hover:border-accent focus-visible:border-accent",
        // Your own row already carries a hint of the accent, so it reads as
        // yours before you look for the label.
        isYou ? "border-accent/40" : "border-border",
      )}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
        <Avatar displayName={displayName} imageUrl={avatarUrl} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-ink">{displayName}</p>
          {isYou ? (
            <span className="shrink-0 rounded-full border border-accent/50 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-accent">
              Tú
            </span>
          ) : null}
        </div>
        <p className="truncate font-mono text-sm text-ink-muted">@{username}</p>
        {memberSince ? (
          <p className="mt-1 font-mono text-xs text-ink-muted">
            Desde {formatMonthAndYear(memberSince)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
