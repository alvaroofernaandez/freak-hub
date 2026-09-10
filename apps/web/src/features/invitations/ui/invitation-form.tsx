"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createInvitation,
  type InvitationFormState,
} from "@/features/invitations/actions/create-invitation";
import { FormField } from "@/shared/ui/form-field";
import { PendingLabel } from "@/shared/ui/pending-label";
import { InlineMessage } from "@/shared/ui/state/inline-message";

const INITIAL_STATE: InvitationFormState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <PendingLabel
        pending={pending}
        idleLabel="Enviar invitación"
        pendingLabel="Enviando…"
      />
    </button>
  );
}

export function InvitationForm() {
  const [state, formAction] = useActionState(createInvitation, INITIAL_STATE);
  const [email, setEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const emailError = state.fieldErrors?.find(
    (error) => error.field === "email",
  )?.message;
  // A form-level message only when the failure didn't tie to the field
  // itself — the field's own error already says it there.
  const formError =
    state.status === "error" && !emailError ? state.message : undefined;

  useEffect(() => {
    if (state.status === "error" && emailError) {
      emailRef.current?.focus();
    }
    if (state.status === "success") {
      setEmail("");
    }
    // React's own form-action handling resets uncontrolled fields once the
    // action settles, success or not — controlling the value is what keeps
    // whatever was typed after a recoverable failure (docs/states.md).
  }, [state, emailError]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormField
        id="email"
        label="Correo de la persona a la que invitas"
        errorText={emailError}
      >
        {(aria) => (
          <div className="flex flex-wrap gap-3">
            <input
              {...aria}
              ref={emailRef}
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="amigo@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-w-64 flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 placeholder:text-ink-muted"
            />
            <SubmitButton />
          </div>
        )}
      </FormField>
      {state.status === "success" ? (
        <InlineMessage tone="success">{state.message}</InlineMessage>
      ) : null}
      {formError ? (
        <InlineMessage tone="error" afterUserAction>
          {formError}
        </InlineMessage>
      ) : null}
    </form>
  );
}
