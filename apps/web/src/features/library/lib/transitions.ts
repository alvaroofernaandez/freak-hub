import type { LibraryEntryStatus } from "@/shared/api/types";

/**
 * The state machine of docs/domain.md, transcribed arrow by arrow — the same
 * table `apps/api/internal/library/entry.go` holds, on this side of the wire.
 *
 * It is duplicated here on purpose, and the duplication has a narrow job: the
 * domain stays the authority (a `PATCH` with an illegal `status` is answered
 * `422 invalid_transition` whatever this file says), but an interface that
 * offers a move the domain is going to refuse has already failed by the time
 * the error arrives. Offering only the legitimate moves is the point; the API
 * enforcing them is the guarantee.
 *
 * The two arrows out of the start node are missing because creating an entry
 * is not a transition: `POST /v1/library` accepts all six, which is why the
 * manual-add form offers all six. The arrows into the end node are missing
 * because leaving the library is a `DELETE`, allowed from any status.
 */
const TRANSITIONS: Record<LibraryEntryStatus, LibraryEntryStatus[]> = {
  wishlist: ["pending"],
  pending: ["in_progress"],
  in_progress: ["on_hold", "completed", "dropped"],
  on_hold: ["in_progress"],
  completed: ["in_progress"],
  dropped: [],
};

/**
 * Where an entry in `from` can legitimately go next, in the order the
 * diagram draws them.
 *
 * `from` itself is deliberately absent: re-sending the status an entry
 * already holds is a no-op the API accepts, but it is not a *move*, and a
 * chip that offers "become what you already are" is noise.
 */
export function allowedTransitions(
  from: LibraryEntryStatus,
): LibraryEntryStatus[] {
  return TRANSITIONS[from];
}

/**
 * Whether the entry can end up in `to`. Staying put counts, exactly as
 * `CanTransition` in the Go domain does: a client re-sending the current
 * status is asking for nothing, and answering "no" to a no-op would punish
 * the ordinary habit of sending back what was already there.
 */
export function canTransition(
  from: LibraryEntryStatus,
  to: LibraryEntryStatus,
): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/**
 * Whether a rating *arriving in a request* is accepted in this status
 * (domain rule 2). Never about one already stored: a score survives a later
 * status change, and re-sending the stored value is a no-op that passes
 * anywhere. The editor leans on both halves — it enables the control only
 * here, and never sends a rating it did not change.
 */
export function canRate(status: LibraryEntryStatus): boolean {
  return status === "completed" || status === "dropped";
}
