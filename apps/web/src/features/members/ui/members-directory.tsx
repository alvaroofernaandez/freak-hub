import { InviteMemberDialog } from "@/features/invitations/ui/invite-member-dialog";
import { PendingInvitationRow } from "@/features/invitations/ui/pending-invitation-row";
import { MemberRow } from "@/features/members/ui/member-row";
import type { InvitationStatus } from "@/shared/api/types";
import { EmptyState } from "@/shared/ui/empty-state";
import { Moulding } from "@/shared/ui/moulding";
import { SectionHeading } from "@/shared/ui/section-heading";

export type DirectoryMember = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  memberSince?: string | null;
};

export type DirectoryInvitation = {
  id: string;
  email: string;
  status: InvitationStatus;
  createdAt: string;
  invitedBy?: string | null;
};

type MembersDirectoryProps = {
  members: DirectoryMember[];
  /** Username of whoever is reading, so their own row can be marked. */
  currentUsername?: string | null;
  /** `null` means the invitations could not be loaded, which is not the same as none. */
  invitations: DirectoryInvitation[] | null;
};

/**
 * The group roster: who is in, and who has been invited but has not walked in
 * yet. Presentation only, so the page above it owns fetching and this stays
 * testable without a network.
 */
export function MembersDirectory({
  members,
  invitations,
  currentUsername,
}: MembersDirectoryProps) {
  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Grupo</h1>
          <p className="text-ink-muted">Quién está dentro.</p>
        </div>
        <InviteMemberDialog />
      </header>

      <section className="space-y-4">
        <SectionHeading title="Miembros" count={members.length} />
        {members.length === 0 ? (
          <EmptyState
            title="Todavía no hay nadie"
            description="Solo se entra por invitación. En cuanto alguien acepte la suya, aparecerá aquí."
          />
        ) : (
          <div
            data-testid="members-grid"
            className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]"
          >
            {members.map((member) => (
              <MemberRow
                key={member.id}
                username={member.username}
                displayName={member.displayName}
                avatarUrl={member.avatarUrl}
                memberSince={member.memberSince}
                isYou={member.username === currentUsername}
              />
            ))}
          </div>
        )}
      </section>

      {invitations === null ? null : (
        <>
          <Moulding />
          <section className="space-y-4">
            <SectionHeading
              title="Invitaciones"
              count={invitations.length}
              description="Personas invitadas que todavía no han entrado."
            />
            {invitations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-soft px-4 py-8 text-center text-sm text-ink-muted">
                No hay invitaciones pendientes.
              </p>
            ) : (
              <ul className="space-y-3">
                {invitations.map((invitation) => (
                  <li key={invitation.id}>
                    <PendingInvitationRow
                      email={invitation.email}
                      status={invitation.status}
                      createdAt={invitation.createdAt}
                      invitedBy={invitation.invitedBy}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
