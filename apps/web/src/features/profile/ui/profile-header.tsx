import type { ReactNode } from "react";
import { Calendar } from "reicon-react";
import { Avatar } from "@/features/members/ui/avatar";

type ProfileHeaderProps = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  /** ISO 8601 timestamp of when the member joined the group. */
  memberSince?: string;
  /** Actions that belong to this profile, e.g. editing your own. */
  actions?: ReactNode;
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
  actions,
}: ProfileHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full sm:h-24 sm:w-24">
        <Avatar displayName={displayName} imageUrl={avatarUrl} />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="truncate text-2xl font-semibold text-ink sm:text-3xl">
          {displayName}
        </h1>
        <p className="truncate font-mono text-sm text-ink-muted">@{username}</p>
        {memberSince ? (
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <Calendar size={14} aria-hidden="true" />
            <span>
              En el grupo desde{" "}
              <time data-testid="profile-member-since" dateTime={memberSince}>
                {formatMemberSince(memberSince)}
              </time>
            </span>
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
