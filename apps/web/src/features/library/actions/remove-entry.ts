"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { normalizeError } from "@/shared/errors/normalize-error";
import type { ErrorContext } from "@/shared/errors/types";
import { apiFetch, MUTATION_TIMEOUT_MS } from "@/shared/lib/api-client";

export interface RemoveEntryFormState {
  status: "idle" | "success" | "error";
  message: string;
}

const schema = z.uuid();

/**
 * `idempotent: false` is the whole point here, and it is not a copy-paste
 * from the other mutations.
 *
 * `DELETE /v1/library/{id}` answers `204` once and `404
 * library_entry_not_found` every time after, so repeating it is not a
 * harmless re-send: it is a request that fails. When a delete times out,
 * nobody knows which side of that line it landed on, and "inténtalo de
 * nuevo" would walk straight into the 404. The copy catalogue already says
 * the right thing for an uncertain write; it only needed to be told this is
 * one.
 */
const CONTEXT: ErrorContext = {
  resource: "tu entrada",
  action: "quitar la entrada de tu biblioteca",
  operation: "submit",
  scope: "operation",
  idempotent: false,
};

/**
 * Takes a work out of your own library. The work itself stays in the shared
 * catalogue — it is history nobody deletes (domain rule 3) — so what leaves
 * is the relationship, not the record.
 *
 * Allowed from any status: the ends of the state diagram are where a life
 * cycle finishes, not a condition on removing.
 */
export async function removeLibraryEntry(
  _previous: RemoveEntryFormState,
  id: string,
): Promise<RemoveEntryFormState> {
  const parsed = schema.safeParse(id);

  if (!parsed.success) {
    return {
      status: "error",
      message: "No hemos encontrado esa entrada. Vuelve a cargar la ficha.",
    };
  }

  const { getToken } = await auth();
  const token = await getToken();

  try {
    // 204 No Content: `apiFetch` returns null, and null is the success.
    await apiFetch(`/v1/library/${parsed.data}`, {
      method: "DELETE",
      token,
      timeoutMs: MUTATION_TIMEOUT_MS,
    });
  } catch (cause) {
    return {
      status: "error",
      message: normalizeError(cause, CONTEXT).copy.description,
    };
  }

  return { status: "success", message: "Entrada quitada de tu biblioteca." };
}
