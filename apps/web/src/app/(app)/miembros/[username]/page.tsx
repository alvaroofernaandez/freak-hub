import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findMember } from "@/features/members/lib/mock-members";
import { FriendProfileView } from "@/features/profile/ui/friend-profile-view";
import { OwnProfileView } from "@/features/profile/ui/own-profile-view";

type ProfilePageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

/**
 * A member's profile: your own (real Clerk identity, editable sections) or
 * a mock friend's (fixed sections, no editing) — docs/screens.md, ADR-0010.
 */
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const user = await currentUser();

  if (user?.username === username) {
    return (
      <OwnProfileView
        displayName={user.fullName ?? user.username}
        username={username}
        avatarUrl={user.imageUrl}
      />
    );
  }

  const member = findMember(username);

  if (!member) {
    notFound();
    return;
  }

  return (
    <FriendProfileView
      displayName={member.displayName}
      username={member.username}
    />
  );
}
