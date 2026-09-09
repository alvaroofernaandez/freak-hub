import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import {
  type DirectoryInvitation,
  MembersDirectory,
} from "@/features/members/ui/members-directory";
import type { GroupInvitationPage, MemberPage } from "@/shared/api/types";
import { apiFetch } from "@/shared/lib/api-client";
import { EmptyState } from "@/shared/ui/empty-state";

export const metadata: Metadata = { title: "Grupo" };

/** Resolves to `null` on failure so one endpoint failing does not blank the page. */
async function fetchOrNull<T>(path: string, token: string | null) {
  try {
    return await apiFetch<T>(path, { token });
  } catch {
    return null;
  }
}

/**
 * Who is inside the group, and who has been invited but has not walked in yet
 * (docs/screens.md#grupo). The roster mirrors Clerk through the `user.created`
 * webhook, so everyone listed here accepted an invitation. Nothing is invented.
 *
 * The two requests are independent on purpose: losing the invitations should
 * not cost you the roster.
 */
export default async function MembersPage() {
  const { getToken } = await auth();
  const token = await getToken();

  const [roster, invitations, you] = await Promise.all([
    fetchOrNull<MemberPage>("/v1/members", token),
    fetchOrNull<GroupInvitationPage>("/v1/invitations/group", token),
    currentUser(),
  ]);

  if (roster === null) {
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Grupo</h1>
          <p className="text-ink-muted">Quién está dentro.</p>
        </div>
        <EmptyState
          title="No se ha podido cargar el grupo"
          description="La API no ha respondido. Vuelve a intentarlo en un momento."
        />
      </section>
    );
  }

  // Only what is still open belongs under "invitations": an accepted one is
  // already a member above, and showing it twice would double-count them.
  const pending: DirectoryInvitation[] | null =
    invitations === null
      ? null
      : invitations.items
          .filter((invitation) => invitation.status === "pending")
          .map((invitation) => ({
            id: invitation.id,
            email: invitation.email,
            status: invitation.status,
            createdAt: invitation.created_at,
            invitedBy: invitation.inviter.display_name,
          }));

  return (
    <MembersDirectory
      members={roster.items.map((member) => ({
        id: member.id,
        username: member.username,
        displayName: member.display_name,
        avatarUrl: member.avatar_url,
        memberSince: member.created_at,
      }))}
      invitations={pending}
      currentUsername={you?.username}
    />
  );
}
