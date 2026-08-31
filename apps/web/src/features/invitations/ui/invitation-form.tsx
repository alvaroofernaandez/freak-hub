"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createInvitation,
  type InvitationFormState,
} from "@/features/invitations/actions/create-invitation";

const INITIAL_STATE: InvitationFormState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-content transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Enviando…" : "Enviar invitación"}
    </button>
  );
}

export function InvitationForm() {
  const [state, formAction] = useActionState(createInvitation, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm text-content-muted">
        Correo de la persona a la que invitas
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="amigo@correo.com"
          className="min-w-64 flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 placeholder:text-content-muted"
        />
        <SubmitButton />
      </div>
      {state.status !== "idle" ? (
        <output
          className={
            state.status === "success"
              ? "text-sm text-accent"
              : "text-sm text-red-400"
          }
        >
          {state.message}
        </output>
      ) : null}
    </form>
  );
}
