import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FriendProfileView } from "@/features/profile/ui/friend-profile-view";
import { OwnProfileView } from "@/features/profile/ui/own-profile-view";
import type { Member, MemberPage } from "@/shared/api/types";
import { normalizeError } from "@/shared/errors/normalize-error";
import { reportError } from "@/shared/errors/report-error";
import { apiFetch } from "@/shared/lib/api-client";
import type { ViewState } from "@/shared/lib/view-state";
import { ErrorState } from "@/shared/ui/state/error-state";
import { SessionExpiredState } from "@/shared/ui/state/session-expired-state";

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
 *
 * A roster fetch failing is *not* the same as the username not being in it
 * (ADR-0014): the former is `error` (or `session_expired`'s own kind, read
 * off the page below), the latter is `empty` — only `empty` becomes a real
 * 404, via `notFound()`.
 */
async function findMember(username: string): Promise<ViewState<Member>> {
  const { getToken } = await auth();

  try {
    const roster = await apiFetch<MemberPage>("/v1/members", {
      token: await getToken(),
    });
    const member = roster.items.find((item) => item.username === username);
    return member ? { status: "ready", data: member } : { status: "empty" };
  } catch (cause) {
    const normalized = normalizeError(cause, {
      resource: "el grupo",
      operation: "load",
      scope: "page",
    });
    reportError(normalized, { route: `/miembros/${username}` });
    return { status: "error", error: normalized };
  }
}

/**
 * A member's profile: your own (editable sections) or another member's
 * (fixed sections, no editing) — docs/screens.md, ADR-0010. Only a username
 * genuinely absent from the roster is a 404 (`app/(app)/miembros/[username]/
 * not-found.tsx`); a session gone or the roster failing to load keep the
 * shell and offer their own recovery instead of masquerading as one.
 */
export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const [user, result] = await Promise.all([
    currentUser(),
    findMember(username),
  ]);

  if (result.status === "error") {
    if (result.error.kind === "session_expired") {
      return (
        <SessionExpiredState
          size="page"
          redirectPath={`/miembros/${username}`}
        />
      );
    }
    return <ErrorState error={result.error} size="page" />;
  }

  if (result.status === "empty") {
    notFound();
    return;
  }

  const member = result.data;

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
