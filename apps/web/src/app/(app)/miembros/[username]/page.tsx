import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FriendProfileView } from "@/features/profile/ui/friend-profile-view";
import { OwnProfileView } from "@/features/profile/ui/own-profile-view";
import type { Member, MemberPage } from "@/shared/api/types";
import { apiFetch } from "@/shared/lib/api-client";

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
 * Looks the member up in the group roster. There is no per-username endpoint
 * yet, and the group is a closed circle of friends, so fetching the roster and
 * finding them in it costs one request either way.
 */
async function findMember(username: string): Promise<Member | null> {
  const { getToken } = await auth();

  try {
    const roster = await apiFetch<MemberPage>("/v1/members", {
      token: await getToken(),
    });
    return roster.items.find((member) => member.username === username) ?? null;
  } catch {
    return null;
  }
}

/**
 * A member's profile: your own (editable sections) or another member's
 * (fixed sections, no editing) — docs/screens.md, ADR-0010. Only people who
 * are actually in the group have a profile; anyone else is a 404.
 */
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const [user, member] = await Promise.all([
    currentUser(),
    findMember(username),
  ]);

  if (member) {
    return user?.username === username ? (
      <OwnProfileView
        displayName={user.fullName ?? member.display_name}
        firstName={user.firstName ?? undefined}
        lastName={user.lastName ?? undefined}
        username={username}
        avatarUrl={user.imageUrl}
        memberSince={member.created_at}
      />
    ) : (
      <FriendProfileView
        displayName={member.display_name}
        username={member.username}
        memberSince={member.created_at}
      />
    );
  }

  notFound();
}
