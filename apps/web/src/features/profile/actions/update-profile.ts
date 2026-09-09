"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ApiError, apiFetch } from "@/shared/lib/api-client";

export interface ProfileFormState {
  status: "idle" | "success" | "error";
  message: string;
}

/** Clerk's own limits, checked here so an invalid edit never reaches the API. */
const USERNAME_MIN = 3;
const USERNAME_MAX = 24;

/** Error codes the API can return, in the words the person editing needs. */
const MESSAGES: Record<string, string> = {
  username_taken: "Ese nombre de usuario ya está cogido. Prueba con otro.",
  username_invalid_length: `El nombre de usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`,
  username_numeric_only: "El nombre de usuario no puede ser solo números.",
  name_too_long: "El nombre o los apellidos son demasiado largos.",
  no_profile_changes: "No has cambiado nada todavía.",
  avatar_too_large: "La foto pesa más de 5 MB. Prueba con una más ligera.",
  avatar_unsupported_type: "Ese archivo no es una imagen válida.",
};

function messageFor(cause: unknown): string {
  if (cause instanceof ApiError && MESSAGES[cause.code]) {
    return MESSAGES[cause.code] as string;
  }
  return "No se han podido guardar los cambios. Inténtalo de nuevo.";
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
    return {
      status: "error",
      message: MESSAGES.username_invalid_length as string,
    };
  }

  if (username !== undefined && /^\d+$/.test(username)) {
    return {
      status: "error",
      message: MESSAGES.username_numeric_only as string,
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

  if (Object.keys(fields).length === 0 && !hasPhoto) {
    return { status: "error", message: MESSAGES.no_profile_changes as string };
  }

  const { getToken } = await auth();
  const token = await getToken();

  try {
    if (hasPhoto) {
      const body = new FormData();
      body.set("file", photo);
      // No Content-Type header: the browser has to set the multipart boundary.
      await apiFetch("/v1/me/avatar", { method: "POST", token, body });
    }

    if (Object.keys(fields).length > 0) {
      await apiFetch("/v1/me", {
        method: "PATCH",
        token,
        body: JSON.stringify(fields),
      });
    }
  } catch (cause) {
    return { status: "error", message: messageFor(cause) };
  }

  revalidatePath("/miembros");

  return { status: "success", message: "Perfil actualizado." };
}
