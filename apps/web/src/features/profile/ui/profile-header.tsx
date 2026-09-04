import { Avatar } from "@/features/members/ui/avatar";

type ProfileHeaderProps = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
};

/** A profile's identity: avatar, display name and handle. */
export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
}: ProfileHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full">
        <Avatar displayName={displayName} imageUrl={avatarUrl} />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{displayName}</h1>
        <p className="font-mono text-sm text-ink-muted">@{username}</p>
      </div>
    </div>
  );
}
