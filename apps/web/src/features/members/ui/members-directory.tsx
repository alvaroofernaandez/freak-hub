import type { CSSProperties } from "react";
import { InvitePopover } from "@/features/invitations/ui/invite-popover";
import { PendingInvitationRow } from "@/features/invitations/ui/pending-invitation-row";
import { MemberRow } from "@/features/members/ui/member-row";
import type { InvitationStatus } from "@/shared/api/types";
import type { NormalizedAppError } from "@/shared/errors/types";
import { staggerStyle } from "@/shared/motion/tokens";
import { EmptyState } from "@/shared/ui/empty-state";
import { Moulding } from "@/shared/ui/moulding";
import { SectionHeading } from "@/shared/ui/section-heading";
import { ErrorState } from "@/shared/ui/state/error-state";
import { InlineMessage } from "@/shared/ui/state/inline-message";

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
  /** A real fetch failure for invitations: renders a retryable section
   * error in the section's place instead of hiding it (ADR-0014 — a silent
   * `null` used to mean the same thing as "not fetched" and "failed"). */
  invitationsError?: NormalizedAppError | null;
  /** The roster asked for the contract's page-size maximum (100) and there
   * is still more behind `next_cursor`: says so instead of truncating in
   * silence. */
  membersHasMore?: boolean;
  invitationsHasMore?: boolean;
};

/**
 * The group roster: who is in, and who has been invited but has not walked in
 * yet. Presentation only, so the page above it owns fetching and this stays
 * testable without a network.
 */
export function MembersDirectory({
  members,
  invitations,
  invitationsError,
  currentUsername,
  membersHasMore,
  invitationsHasMore,
}: MembersDirectoryProps) {
  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Grupo</h1>
          <p className="text-ink-muted">Quién está dentro.</p>
        </div>
        <InvitePopover />
      </header>

      <section className="space-y-4">
        <SectionHeading title="Miembros" count={members.length} />
        {members.length === 0 ? (
          <EmptyState
            title="Todavía no hay nadie"
            description="Solo se entra por invitación. En cuanto alguien acepte la suya, aparecerá aquí."
          />
        ) : (
          <>
            <div
              data-testid="members-grid"
              className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]"
            >
              {members.map((member, index) => (
                <div
                  key={member.id}
                  data-testid="member-row-slot"
                  className="stagger-in"
                  style={staggerStyle(index) as CSSProperties}
                >
                  <MemberRow
                    username={member.username}
                    displayName={member.displayName}
                    avatarUrl={member.avatarUrl}
                    memberSince={member.memberSince}
                    isYou={member.username === currentUsername}
                  />
                </div>
              ))}
            </div>
            {membersHasMore ? (
              <InlineMessage tone="info">
                Hay más miembros de los que se muestran aquí.
              </InlineMessage>
            ) : null}
          </>
        )}
      </section>

      {invitations === null && !invitationsError ? null : (
        <>
          <Moulding />
          <section className="space-y-4">
            <SectionHeading
              title="Invitaciones"
              count={invitationsError ? undefined : (invitations?.length ?? 0)}
              description="Personas invitadas que todavía no han entrado."
            />
            {invitationsError ? (
              <ErrorState error={invitationsError} size="section" />
            ) : invitations && invitations.length === 0 ? (
              <EmptyState
                size="inline"
                title="No hay invitaciones pendientes"
                description="Cuando invites a alguien, aparecerá aquí hasta que entre."
              />
            ) : invitations ? (
              <>
                <ul className="space-y-3">
                  {invitations.map((invitation, index) => (
                    <li
                      key={invitation.id}
                      className="stagger-in"
                      style={staggerStyle(index) as CSSProperties}
                    >
                      <PendingInvitationRow
                        email={invitation.email}
                        status={invitation.status}
                        createdAt={invitation.createdAt}
                        invitedBy={invitation.invitedBy}
                      />
                    </li>
                  ))}
                </ul>
                {invitationsHasMore ? (
                  <InlineMessage tone="info">
                    Hay más invitaciones de las que se muestran aquí.
                  </InlineMessage>
                ) : null}
              </>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
