"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import type {
  LibraryEntry,
  LibraryEntryStatus,
  UpdateLibraryEntryRequest,
} from "@/shared/api/types";
import { normalizeError } from "@/shared/errors/normalize-error";
import type { ErrorContext } from "@/shared/errors/types";
import { apiFetch, MUTATION_TIMEOUT_MS } from "@/shared/lib/api-client";

/**
 * What the editor asks to change, and nothing else.
 *
 * Every property is optional because `PATCH /v1/library/{id}` reads absent,
 * `null` and a value as three different instructions: absent leaves the
 * stored value alone, `null` clears it on purpose, a value writes it. That
 * is why this is a hand-built diff rather than the whole entry — sending
 * back an object the person never edited would turn every save into a
 * rewrite of fields they cannot see.
 *
 * `rating: null` is the only way to remove a score, and it is deliberately
 * reachable: `rating?: number | null` keeps "clear it" and "do not touch it"
 * apart, which `rating?: number` alone could not.
 */
export type EntryPatch = {
  status?: LibraryEntryStatus;
  progress?: number;
  rating?: number | null;
  is_favourite?: boolean;
  owned?: boolean;
};

export interface UpdateEntryFormState {
  status: "idle" | "success" | "error";
  message: string;
}

const STATUSES = [
  "wishlist",
  "pending",
  "in_progress",
  "completed",
  "dropped",
  "on_hold",
] as const;

/** The bounds `UpdateLibraryEntryRequest` declares. Checked before the
 * network, so a number the contract would refuse never becomes a round trip.
 * The *rules* (which transition is legal, when a rating is allowed) stay
 * with the domain: this only guards the shape. */
const schema = z.object({
  id: z.uuid(),
  patch: z
    .object({
      status: z.enum(STATUSES).optional(),
      progress: z.number().int().min(0).optional(),
      rating: z.number().int().min(1).max(10).nullable().optional(),
      is_favourite: z.boolean().optional(),
      owned: z.boolean().optional(),
    })
    .strict(),
});

const CONTEXT: ErrorContext = {
  resource: "tu entrada",
  action: "guardar los cambios de la entrada",
  operation: "submit",
  scope: "operation",
  // A second identical PATCH is not a re-read: it is a second write, and a
  // status in it is a second transition attempt.
  idempotent: false,
};

/**
 * Saves the fields the person actually changed on their own entry.
 *
 * Three clauses of the contract are load-bearing here and none of them can
 * be honoured by sending the whole object:
 *
 * 1. **Absent, `null` and a value are three instructions.** The caller
 *    builds the diff; this only refuses a shape the contract would.
 * 2. **A `status` is a transition**, checked against the state machine in
 *    docs/domain.md and answered `422 invalid_transition` when it is not
 *    one. The editor does not offer illegitimate moves, so this should not
 *    normally fire — and when it does (a stale page, two tabs) the message
 *    is the one `messages.ts` already holds for that code.
 * 3. **A stored rating survives a status change.** Nothing here erases a
 *    score, ever: a rating travels only when the caller changed it, so
 *    `completed → in_progress` on an entry rated 8 sends `{status}` alone
 *    and the 8 stays. Clearing is an explicit `null`, never a side effect.
 *
 * No optimistic update: the answer comes back before the page refreshes
 * (docs/states.md).
 */
export async function updateLibraryEntry(
  _previous: UpdateEntryFormState,
  payload: { id: string; patch: EntryPatch },
): Promise<UpdateEntryFormState> {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message:
        "No hemos podido guardar esos valores. Vuelve a cargar la ficha.",
    };
  }

  const { id, patch } = parsed.data;

  // A body with no properties is a no-op the API answers 200 to, so nothing
  // would break; spending a round trip to be told nothing happened is just
  // waste. The editor already disables its save button in this case.
  if (Object.keys(patch).length === 0) {
    return { status: "idle", message: "" };
  }

  const { getToken } = await auth();
  const token = await getToken();

  try {
    const body: UpdateLibraryEntryRequest = patch;
    await apiFetch<LibraryEntry>(`/v1/library/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
      timeoutMs: MUTATION_TIMEOUT_MS,
    });
  } catch (cause) {
    // Always the normalizer's copy: `invalid_transition` and
    // `rating_not_allowed` are already in `messages.ts`, so there is no
    // second copy map here saying the same thing worse.
    return {
      status: "error",
      message: normalizeError(cause, CONTEXT).copy.description,
    };
  }

  return { status: "success", message: "Entrada actualizada." };
}
