import { Avatar } from "@/features/members/ui/avatar";

type ProfileHeaderProps = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  /**
   * ISO 8601 timestamp of when the member joined the group. Optional: the
   * own-profile view has it (via the mock members' `memberSince`, docs/
   * roadmap.md), the friend-profile view doesn't wire it in yet (#31) —
   * the line only renders once a caller passes it in.
   */
  memberSince?: string;
};

const memberSinceFormatter = new Intl.DateTimeFormat("es", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Formats an ISO timestamp as "{mes} de {año}" in Spanish, e.g. "marzo de 2022". */
function formatMemberSince(memberSince: string): string {
  return memberSinceFormatter.format(new Date(memberSince));
}

/** A profile's identity: avatar, display name, handle and, when known, member-since. */
export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  memberSince,
}: ProfileHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full">
        <Avatar displayName={displayName} imageUrl={avatarUrl} />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{displayName}</h1>
        <p className="text-sm text-ink-muted">
          <span className="font-mono">@{username}</span>
          {memberSince
            ? ` · en el grupo desde ${formatMemberSince(memberSince)}`
            : null}
        </p>
      </div>
    </div>
  );
}
