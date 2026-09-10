"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import type { Invitation } from "@/shared/api/types";
import { MESSAGES } from "@/shared/errors/messages";
import { normalizeError } from "@/shared/errors/normalize-error";
import type { ProblemCode } from "@/shared/errors/problem";
import type { ErrorContext } from "@/shared/errors/types";
import { apiFetch, MUTATION_TIMEOUT_MS } from "@/shared/lib/api-client";

const schema = z.object({
  email: z.email({ message: "Escribe un correo válido." }),
});

export interface InvitationFieldError {
  field: string;
  message: string;
}

export interface InvitationFormState {
  status: "idle" | "success" | "error";
  message: string;
  /** Set only when the failure ties to the email field — `invitation-form.tsx`
   * and `invite-popover.tsx` wire it via `aria-invalid`/`aria-describedby`. */
  fieldErrors?: InvitationFieldError[];
}

/** Sending an invitation is never safe to retry blindly: a second identical
 * request is a second invitation attempt, not a re-fetch of the same data. */
const CONTEXT: ErrorContext = {
  resource: "la invitación",
  action: "enviar la invitación",
  operation: "submit",
  scope: "operation",
  idempotent: false,
};

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
    const message = parsed.error.issues[0]?.message ?? "Datos no válidos.";
    return {
      status: "error",
      message,
      fieldErrors: [{ field: "email", message }],
    };
  }

  const { getToken } = await auth();
  const token = await getToken();

  try {
    await apiFetch<Invitation>("/v1/invitations", {
      method: "POST",
      token,
      body: JSON.stringify({ email: parsed.data.email }),
      timeoutMs: MUTATION_TIMEOUT_MS,
    });
  } catch (cause) {
    const normalized = normalizeError(cause, CONTEXT);
    const fieldErrors = normalized.fieldErrors?.map(({ field, code }) => ({
      field,
      message: (code in MESSAGES
        ? MESSAGES[code as ProblemCode](CONTEXT)
        : normalized.copy
      ).description,
    }));

    // Always the normalizer's copy: it names the real cause (an expired
    // session, an outage, a send whose outcome is unknown) instead of one
    // generic "try again" that fits none of them.
    return {
      status: "error",
      message: normalized.copy.description,
      fieldErrors,
    };
  }

  return {
    status: "success",
    message: `Invitación enviada a ${parsed.data.email}.`,
  };
}
