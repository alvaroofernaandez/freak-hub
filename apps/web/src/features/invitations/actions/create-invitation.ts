"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import type { Invitation } from "@/shared/api/types";
import { ApiError, apiFetch } from "@/shared/lib/api-client";

const schema = z.object({
  email: z.email({ message: "Escribe un correo válido." }),
});

export interface InvitationFormState {
  status: "idle" | "success" | "error";
  message: string;
}

/**
 * Any member can invite. The Go API is the one that talks to Clerk's Backend
 * API, so the invite quota, the audit trail and the rate limit live in a single
 * place instead of being duplicated per client.
 */
export async function createInvitation(
  _previous: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const parsed = schema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    };
  }

  const { getToken } = await auth();
  const token = await getToken();

  try {
    await apiFetch<Invitation>("/v1/invitations", {
      method: "POST",
      token,
      body: JSON.stringify({ email: parsed.data.email }),
    });
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === "invitation_already_sent") {
      return {
        status: "error",
        message: "Ya hay una invitación pendiente para ese correo.",
      };
    }

    return {
      status: "error",
      message: "No se pudo enviar la invitación. Inténtalo de nuevo.",
    };
  }

  return {
    status: "success",
    message: `Invitación enviada a ${parsed.data.email}.`,
  };
}
