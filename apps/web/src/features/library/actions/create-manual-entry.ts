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
  /** The work reached the catalogue but the library entry did not. The form
   * reads this to keep its own submit button down for good: there is no way
   * to finish the job from here, and pressing again would mint a duplicate
   * work that nothing can remove. */
  workCreated?: boolean;
  /** Set only when the failure ties to one field, so `manual-add-form.tsx`
   * can wire `aria-invalid`/`aria-describedby` and focus the first one. */
  fieldErrors?: ManualEntryFieldError[];
}

/**
 * The bounds `CreateWorkRequest` declares in
 * `packages/contracts/openapi.yaml`. Checked here so a value the contract
 * would reject never becomes a round trip — the same reason
 * `edit-profile-dialog.tsx` checks the avatar's size before uploading it.
 *
 * They are *not* exactly the API's bounds, and the difference is worth
 * knowing rather than discovering. A JavaScript string's `.length` counts
 * UTF-16 code units, while `apps/api/internal/library/service.go` counts
 * runes (`len([]rune(title))`). An emoji or any astral character therefore
 * costs two here and one there, so this side is the stricter of the two. The
 * safe direction, and deliberate: nothing this accepts can be refused there
 * for length.
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

/**
 * Postgres cannot store a NUL inside a text value, so the API refuses one
 * outright (`carriesNullCharacter` in `apps/api/internal/library/service.go`)
 * rather than letting the driver fail deeper down. Nobody types one, but a
 * paste from a binary file carries them, and it is one `refine` here against
 * an error nobody could act on there.
 */
const NO_NUL = (value: string) => !value.includes("\u0000");
const NUL_MESSAGE = "Ese texto lleva un carácter que no se puede guardar.";

/** An empty text field is "not given", which the contract spells `null`. */
const optionalText = z
  .string()
  .refine(NO_NUL, { message: NUL_MESSAGE })
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? null : value));

const schema = z.object({
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES, {
    message: "Elige en qué punto estás con esta obra.",
  }),
  title: z
    .string()
    .refine(NO_NUL, { message: NUL_MESSAGE })
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
 * The half-done case, stated plainly — and it took a review to make this
 * paragraph honest.
 *
 * The two writes are not one transaction and cannot be: `POST /v1/works` is
 * the only way to learn the id `POST /v1/library` needs. When the first
 * succeeds and the second does not, the work exists in the shared catalogue,
 * a work is never deleted (domain rule 3), and a manual work carries no
 * `source_id`, so `works_source_idx` will not dedupe a second one. Submitting
 * again mints a duplicate that nothing can clean up.
 *
 * The first version of this message told people to "find it under Añadir and
 * add it from there". **There is no such flow.** `/anadir/[categoria]`
 * searches AniList and nothing else, `GET /v1/works` is consumed nowhere in
 * the web app, `catalog-search-results.tsx` deliberately ships no add button,
 * and the only caller of `POST /v1/library` is this action. So the message
 * sent somebody on an errand that ends where it started, and the one thing
 * left to try was the one thing it forbade — which is how a warning gets
 * ignored.
 *
 * There is no remedy to name, so it names none. What it can do is stop the
 * next press: `workCreated` keeps the form's own button down.
 */
const WORK_ALREADY_CREATED =
  "La obra sí se ha creado en el catálogo del grupo, y una obra no se borra " +
  "nunca. No vuelvas a enviar este formulario: crearía una segunda obra " +
  "igual. Todavía no hay ninguna pantalla para añadir a tu biblioteca una " +
  "obra que ya existe, así que esta entrada tendrá que esperar a que la haya.";

function stateFor(
  cause: unknown,
  context: ErrorContext,
  suffix?: string,
  workCreated?: boolean,
): ManualEntryFormState {
  const normalized = normalizeError(cause, context);
  // Always the normalizer's copy: it names the real cause (an expired
  // session, an outage, a write whose outcome is unknown) instead of one
  // generic "try again" that fits none of them.
  const description = normalized.copy.description;

  return {
    status: "error",
    message: suffix ? `${description} ${suffix}` : description,
    ...(workCreated ? { workCreated: true } : {}),
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
    return stateFor(cause, ENTRY_CONTEXT, WORK_ALREADY_CREATED, true);
  }

  redirect(`/obras/${entry.id}`);
}
