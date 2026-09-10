"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_BYTES,
  MESSAGES,
  USERNAME_MAX,
  USERNAME_MIN,
} from "@/shared/errors/messages";
import { normalizeError } from "@/shared/errors/normalize-error";
import type { ProblemCode } from "@/shared/errors/problem";
import type { ErrorContext } from "@/shared/errors/types";
import { apiFetch, MUTATION_TIMEOUT_MS } from "@/shared/lib/api-client";

export interface ProfileFieldError {
  field: string;
  message: string;
}

export interface ProfileFormState {
  status: "idle" | "success" | "error";
  message: string;
  /** Set only when the failure ties to one field — `edit-profile-dialog.tsx`
   * wires each entry to its own input via `aria-invalid`/`aria-describedby`
   * and focuses the first one. Absent for a form-level failure. */
  fieldErrors?: ProfileFieldError[];
}

const CONTEXT: ErrorContext = {
  resource: "tu perfil",
  operation: "submit",
  scope: "operation",
  idempotent: false,
};

function messageFor(cause: unknown): string {
  return normalizeError(cause, CONTEXT).copy.description;
}

/** Maps a normalized error's `fieldErrors` (`{field, code}`, from the
 * Problem) to display copy, reusing the same `messages.ts` resolvers a
 * form-level message would use — never a second, invented copy map
 * (docs/states.md). */
function fieldErrorsFor(cause: unknown): ProfileFieldError[] | undefined {
  const normalized = normalizeError(cause, CONTEXT);
  return normalized.fieldErrors?.map(({ field, code }) => ({
    field,
    message: (code in MESSAGES
      ? MESSAGES[code as ProblemCode](CONTEXT)
      : normalized.copy
    ).description,
  }));
}

function trimmed(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

/**
 * Saves your own profile. Next never talks to Clerk: the Go API owns that call,
 * so validation, rate limiting and the audit trail live in one place. Clerk's
 * `user.updated` webhook then syncs the `members` row.
 *
 * The photo travels on its own endpoint because it is multipart; the text
 * fields go as JSON.
 */
export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const username = trimmed(formData.get("username"));

  if (
    username !== undefined &&
    (username.length < USERNAME_MIN || username.length > USERNAME_MAX)
  ) {
    const message = MESSAGES.username_invalid_length(CONTEXT).description;
    return {
      status: "error",
      message,
      fieldErrors: [{ field: "username", message }],
    };
  }

  if (username !== undefined && /^\d+$/.test(username)) {
    const message = MESSAGES.username_numeric_only(CONTEXT).description;
    return {
      status: "error",
      message,
      fieldErrors: [{ field: "username", message }],
    };
  }

  const fields: Record<string, string> = {};
  for (const key of ["first_name", "last_name", "username"] as const) {
    const value = trimmed(formData.get(key));
    if (value !== undefined) {
      fields[key] = value;
    }
  }

  const photo = formData.get("avatar");
  const hasPhoto = photo instanceof File && photo.size > 0;

  if (hasPhoto && photo.size > AVATAR_MAX_BYTES) {
    const message = MESSAGES.avatar_too_large(CONTEXT).description;
    return {
      status: "error",
      message,
      fieldErrors: [{ field: "avatar", message }],
    };
  }

  if (
    hasPhoto &&
    !(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(photo.type)
  ) {
    const message = MESSAGES.avatar_unsupported_type(CONTEXT).description;
    return {
      status: "error",
      message,
      fieldErrors: [{ field: "avatar", message }],
    };
  }

  if (Object.keys(fields).length === 0 && !hasPhoto) {
    return {
      status: "error",
      message: MESSAGES.no_profile_changes(CONTEXT).description,
    };
  }

  const { getToken } = await auth();
  const token = await getToken();

  try {
    if (hasPhoto) {
      const body = new FormData();
      body.set("file", photo);
      // No Content-Type header: the browser has to set the multipart boundary.
      await apiFetch("/v1/me/avatar", {
        method: "POST",
        token,
        body,
        timeoutMs: MUTATION_TIMEOUT_MS,
      });
    }

    if (Object.keys(fields).length > 0) {
      await apiFetch("/v1/me", {
        method: "PATCH",
        token,
        body: JSON.stringify(fields),
        timeoutMs: MUTATION_TIMEOUT_MS,
      });
    }
  } catch (cause) {
    return {
      status: "error",
      message: messageFor(cause),
      fieldErrors: fieldErrorsFor(cause),
    };
  }

  revalidatePath("/miembros");

  return { status: "success", message: "Perfil actualizado." };
}
