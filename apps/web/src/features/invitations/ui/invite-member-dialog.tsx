"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "reicon-react";
import {
  createInvitation,
  type InvitationFormState,
} from "@/features/invitations/actions/create-invitation";
import { Dialog } from "@/shared/ui/dialog";

const INITIAL_STATE: InvitationFormState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Enviando…" : "Enviar invitación"}
    </button>
  );
}

/**
 * Invites somebody without ever showing Clerk. The server action posts to the
 * Go API, which is what talks to Clerk's Backend API, so the invite quota and
 * the audit trail stay in one place (see create-invitation.ts).
 *
 * The dialog stays open after a successful send: inviting two or three people
 * in a row is the common case, and closing on success would make the second
 * invitation cost a full reopen.
 */
export function InviteMemberDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction] = useActionState(createInvitation, INITIAL_STATE);
  const titleId = useId();
  const emailId = useId();
  const router = useRouter();

  useEffect(() => {
    // A sent invitation belongs in the pending list behind this dialog.
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
      >
        <Plus size={16} aria-hidden="true" />
        Invitar
      </button>

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        titleId={titleId}
      >
        <div className="space-y-1.5">
          <h2 id={titleId} className="text-[19px] font-bold text-ink">
            Invitar a alguien
          </h2>
          <p className="text-sm text-ink-muted">
            Solo se entra por invitación. Queda registrado quién invitó a quién.
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <label htmlFor={emailId} className="text-sm text-ink-muted">
            Correo de la persona a la que invitas
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="amigo@correo.com"
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm placeholder:text-ink-muted"
          />

          {state.status !== "idle" ? (
            <output
              className={
                state.status === "success"
                  ? "text-sm text-accent"
                  : "text-sm text-danger"
              }
            >
              {state.message}
            </output>
          ) : null}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Cancelar
            </button>
            <SubmitButton />
          </div>
        </form>
      </Dialog>
    </>
  );
}
