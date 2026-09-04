import Link from "next/link";
import { Avatar } from "@/features/members/ui/avatar";

type MemberRowProps = {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

/** A row in the group listing, linking to the member's profile (docs/screens.md). */
export function MemberRow({
  username,
  displayName,
  avatarUrl,
}: MemberRowProps) {
  return (
    <Link
      href={`/miembros/${username}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3"
    >
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
        <Avatar displayName={displayName} imageUrl={avatarUrl} />
      </div>
      <div>
        <p className="font-medium">{displayName}</p>
        <p className="font-mono text-sm text-ink-muted">@{username}</p>
      </div>
    </Link>
  );
}
