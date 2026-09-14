"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { CreateWorkRequest, LibraryEntry, Work } from "@/shared/api/types";
import { MESSAGES } from "@/shared/errors/messages";
import { normalizeError } from "@/shared/errors/normalize-error";
import type { ProblemCode } from "@/shared/errors/problem";
import type { ErrorContext } from "@/shared/errors/types";
import { apiFetch, MUTATION_TIMEOUT_MS } from "@/shared/lib/api-client";

export interface ManualEntryFieldError {
  field: string;
  message: string;
}

export interface ManualEntryFormState {
  status: "idle" | "error";
  message: string;
  /** Set only when the failure ties to one field, so `manual-add-form.tsx`
   * can wire `aria-invalid`/`aria-describedby` and focus the first one. */
  fieldErrors?: ManualEntryFieldError[];
}

/**
 * The bounds `CreateWorkRequest` declares in
 * `packages/contracts/openapi.yaml`. Checked here so a value the contract
 * would reject never becomes a round trip — the same reason
 * `edit-profile-dialog.tsx` checks the avatar's size before uploading it.
 */
const TITLE_MAX = 300;
const SYNOPSIS_MAX = 5000;
const YEAR_MIN = 1800;
const YEAR_MAX = 2200;

const CATEGORIES = [
  "anime",
  "manga",
  "game",
  "film",
  "boardgame",
  "tcg",
] as const;

/**
 * All six statuses, with no default. `CreateLibraryEntryRequest.status` is
 * required precisely because there is nothing sensible to guess: wanting
 * something, already owning it and having finished it years ago are equally
 * normal ways to start. Creating is the entry point into the lifecycle, not
 * a transition, so the state machine does not narrow this list — unlike the
 * editor on the work page, which it does narrow.
 */
const STATUSES = [
  "wishlist",
  "pending",
  "in_progress",
  "completed",
  "dropped",
  "on_hold",
] as const;

/** An empty text field is "not given", which the contract spells `null`. */
const optionalText = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? null : value));

const schema = z.object({
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES, {
    message: "Elige en qué punto estás con esta obra.",
  }),
  title: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, { message: "Escribe un título." })
        .max(TITLE_MAX, {
          message: `El título no puede pasar de ${TITLE_MAX} caracteres.`,
        }),
    ),
  synopsis: optionalText.pipe(
    z
      .string()
      .max(SYNOPSIS_MAX, {
        message: `La sinopsis no puede pasar de ${SYNOPSIS_MAX} caracteres.`,
      })
      .nullable(),
  ),
  // Coerced by hand rather than with `z.coerce.number()`, whose input type
  // is `unknown` and so will not accept the `string | null` this pipes in.
  // `Number("ayer")` is `NaN`, which `Number.isInteger` rejects, so a year
  // that is not a number lands on the same message as a fractional one.
  year: optionalText
    .transform((value) => (value === null ? null : Number(value)))
    .refine((value) => value === null || Number.isInteger(value), {
      message: "El año tiene que ser un número entero.",
    })
    .refine(
      (value) => value === null || (value >= YEAR_MIN && value <= YEAR_MAX),
      { message: `El año tiene que estar entre ${YEAR_MIN} y ${YEAR_MAX}.` },
    ),
});

/** Creating a work is never safe to repeat blindly: a second identical
 * request is a second work, and `POST /v1/works` has nothing to dedupe
 * against — `works_source_idx` only guards catalogue imports, and a manual
 * work carries no `source_id`. */
const WORK_CONTEXT: ErrorContext = {
  resource: "la obra",
  action: "crear la obra",
  operation: "submit",
  scope: "operation",
  idempotent: false,
};

const ENTRY_CONTEXT: ErrorContext = {
  resource: "tu biblioteca",
  action: "añadir la obra a tu biblioteca",
  operation: "submit",
  scope: "operation",
  idempotent: false,
};

/**
 * The half-done case, stated plainly.
 *
 * The two writes are not one transaction and cannot be: `POST /v1/works` is
 * the only way to learn the id `POST /v1/library` needs. When the first
 * succeeds and the second does not, the work exists in the shared catalogue
 * and a work is never deleted (domain rule 3), so submitting the form again
 * would create a second, identical one. Saying so is the only thing that
 * stops it.
 */
const WORK_ALREADY_CREATED =
  "La obra ya se ha creado en el catálogo, así que no vuelvas a enviar el " +
  "formulario: búscala desde «Añadir» y añádela a tu biblioteca desde ahí.";

function stateFor(
  cause: unknown,
  context: ErrorContext,
  suffix?: string,
): ManualEntryFormState {
  const normalized = normalizeError(cause, context);
  // Always the normalizer's copy: it names the real cause (an expired
  // session, an outage, a write whose outcome is unknown) instead of one
  // generic "try again" that fits none of them.
  const description = normalized.copy.description;

  return {
    status: "error",
    message: suffix ? `${description} ${suffix}` : description,
    fieldErrors: normalized.fieldErrors?.map(({ field, code }) => ({
      field,
      message: (code in MESSAGES
        ? MESSAGES[code as ProblemCode](context)
        : normalized.copy
      ).description,
    })),
  };
}

/**
 * Manual entry: what the catalogue search does not find (docs/catalogs.md).
 *
 * Two writes, in order, because the second needs the first's id. `source` is
 * not sent and could not be: `POST /v1/works` creates `manual` by definition
 * and refuses the field, so nothing here can claim a record came from
 * AniList when nobody checked.
 *
 * On success this never returns — `redirect()` throws — so the form's state
 * has no `"success"` branch: the proof that it worked is the entry's own
 * page. The call sits outside the `try`, or the redirect's own control-flow
 * exception would be caught and reported as a failure.
 */
export async function createManualEntry(
  _previous: ManualEntryFormState,
  formData: FormData,
): Promise<ManualEntryFormState> {
  const parsed = schema.safeParse({
    category: formData.get("category"),
    status: formData.get("status"),
    title: formData.get("title") ?? "",
    synopsis: formData.get("synopsis") ?? "",
    year: formData.get("year") ?? "",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.message ?? "Revisa los datos del formulario.";
    const field = issue?.path[0];

    return {
      status: "error",
      message,
      // `category` is the only field with no place to show an error: it
      // comes from the route, not from anything the person typed, so a
      // failure there is a form-level message rather than a field one.
      ...(typeof field === "string" && field !== "category"
        ? { fieldErrors: [{ field, message }] }
        : {}),
    };
  }

  const { category, status, title, synopsis, year } = parsed.data;
  const { getToken } = await auth();
  const token = await getToken();

  let work: Work;
  try {
    const body: CreateWorkRequest = { title, category, synopsis, year };
    work = await apiFetch<Work>("/v1/works", {
      method: "POST",
      token,
      body: JSON.stringify(body),
      timeoutMs: MUTATION_TIMEOUT_MS,
    });
  } catch (cause) {
    return stateFor(cause, WORK_CONTEXT);
  }

  let entry: LibraryEntry;
  try {
    entry = await apiFetch<LibraryEntry>("/v1/library", {
      method: "POST",
      token,
      body: JSON.stringify({ work_id: work.id, status }),
      timeoutMs: MUTATION_TIMEOUT_MS,
    });
  } catch (cause) {
    return stateFor(cause, ENTRY_CONTEXT, WORK_ALREADY_CREATED);
  }

  redirect(`/obras/${entry.id}`);
}
