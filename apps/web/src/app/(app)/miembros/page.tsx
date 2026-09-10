import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import {
  type DirectoryInvitation,
  MembersDirectory,
} from "@/features/members/ui/members-directory";
import type { GroupInvitationPage, MemberPage } from "@/shared/api/types";
import { normalizeError } from "@/shared/errors/normalize-error";
import { reportError } from "@/shared/errors/report-error";
import type { NormalizedAppError } from "@/shared/errors/types";
import { apiFetch } from "@/shared/lib/api-client";
import { ErrorState } from "@/shared/ui/state/error-state";
import { SessionExpiredState } from "@/shared/ui/state/session-expired-state";

export const metadata: Metadata = { title: "Grupo" };

/** The contract's page-size maximum (docs/api.md#paginación). Both listings
 * on this page ask for it up front instead of the 25-item default, and the
 * page still says so if `next_cursor` remains non-null rather than
 * truncating in silence (ADR-0014). */
const PAGE_LIMIT = 100;

/** Both requests here either succeed or fail outright — neither has an
 * "empty" outcome distinct from `data` being an empty list — so this omits
 * `ViewState`'s third `empty` branch rather than reusing it unnarrowed. */
type LoadResult<T> =
  | { status: "ready"; data: T }
  | { status: "error"; error: NormalizedAppError };

async function fetchResource<T>(
  path: string,
  token: string | null,
  resource: string,
): Promise<LoadResult<T>> {
  try {
    return { status: "ready", data: await apiFetch<T>(path, { token }) };
  } catch (cause) {
    const normalized = normalizeError(cause, {
      resource,
      operation: "load",
      scope: "page",
    });
    reportError(normalized, { route: "/miembros" });
    return { status: "error", error: normalized };
  }
}

/**
 * Who is inside the group, and who has been invited but has not walked in yet
 * (docs/screens.md#grupo). The roster mirrors Clerk through the `user.created`
 * webhook, so everyone listed here accepted an invitation. Nothing is invented.
 *
 * The two requests are independent on purpose: losing the invitations should
 * not cost you the roster — it becomes a retryable section error instead
 * (`MembersDirectory`'s `invitationsError`), never a silent gap.
 */
export default async function MembersPage() {
  const { getToken } = await auth();
  const token = await getToken();

  const [rosterState, invitationsState, you] = await Promise.all([
    fetchResource<MemberPage>(
      `/v1/members?limit=${PAGE_LIMIT}`,
      token,
      "el grupo",
    ),
    fetchResource<GroupInvitationPage>(
      `/v1/invitations/group?limit=${PAGE_LIMIT}`,
      token,
      "las invitaciones",
    ),
    currentUser(),
  ]);

  if (rosterState.status === "error") {
    if (rosterState.error.kind === "session_expired") {
      return <SessionExpiredState size="page" redirectPath="/miembros" />;
    }

    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Grupo</h1>
          <p className="text-ink-muted">Quién está dentro.</p>
        </div>
        <ErrorState error={rosterState.error} size="section" />
      </section>
    );
  }

  const roster = rosterState.data;
  const invitationsError: NormalizedAppError | null =
    invitationsState.status === "error" ? invitationsState.error : null;
  const invitationsPage =
    invitationsState.status === "ready" ? invitationsState.data : null;

  // Only what is still open belongs under "invitations": an accepted one is
  // already a member above, and showing it twice would double-count them.
  const pending: DirectoryInvitation[] | null = invitationsPage
    ? invitationsPage.items
        .filter((invitation) => invitation.status === "pending")
        .map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          createdAt: invitation.created_at,
          invitedBy: invitation.inviter.display_name,
        }))
    : null;

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
      invitationsError={invitationsError}
      currentUsername={you?.username}
      membersHasMore={roster.next_cursor !== null}
      invitationsHasMore={invitationsPage?.next_cursor != null}
    />
  );
}
