import { Envelope } from "reicon-react";
import type { InvitationStatus } from "@/shared/api/types";
import { InvitationStatusBadge } from "./invitation-status-badge";

type PendingInvitationRowProps = {
  email: string;
  status: InvitationStatus;
  /** ISO 8601 timestamp of when the invitation was sent. */
  createdAt: string;
  /** Display name of the member who sent it, when known. */
  invitedBy?: string | null;
};

const sentAtFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Somebody who has been invited but has not walked in yet. Deliberately not a
 * `MemberRow`: the dashed outline and the envelope mark say "not here yet"
 * without relying on colour, and there is no profile to link to.
 */
export function PendingInvitationRow({
  email,
  status,
  createdAt,
  invitedBy,
}: PendingInvitationRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface/40 p-3">
      <div
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-ink-muted"
      >
        <Envelope size={18} />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-mono text-sm text-ink">{email}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
          <time data-testid="invitation-sent-at" dateTime={createdAt}>
            {sentAtFormatter.format(new Date(createdAt))}
          </time>
          {invitedBy ? <span>· Invitada por {invitedBy}</span> : null}
        </p>
      </div>
      <InvitationStatusBadge status={status} />
    </div>
  );
}
