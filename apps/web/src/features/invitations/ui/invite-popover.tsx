"use client";

// Adapted from Cult UI's `popover-form.tsx`
// (github.com/nolly-studio/cult-ui, apps/www/registry/default/ui/popover-form.tsx).
// Changed from the original:
//   - built on `@radix-ui/react-popover` (`modal`, for focus trap and
//     outside-pointer blocking) instead of a hand-rolled `mousedown`/
//     `touchstart` "click outside" listener with no Escape handling and no
//     focus management at all;
//   - the trigger carries no manual `aria-hidden`/`tabIndex`: it is still the
//     focused element for a tick when the panel opens (before autofocus
//     moves into the email field), and hiding the currently-focused element
//     from assistive tech is an ARIA violation. `Popover.Root modal` already
//     calls `hideOthers` on everything outside the portaled panel, so the
//     rest of the page is hidden from AT without touching the trigger itself;
//   - reuses this project's `LAYOUT_SPRING`/`DURATION`/`EASE_OUT_QUINT`
//     tokens instead of the original's bespoke springs, and drops the
//     `filter: blur(4px)` it animated on both the panel and its content;
//   - reicon-react's `Check`/`Plus` instead of lucide-react;
//   - wired to this project's real invite flow: the same server action,
//     the same validation and error copy as the dialog it replaces, instead
//     of a generic `openChild`/`successChild` slot API with no backing
//     data;
//   - stays open on a successful send instead of closing itself: same
//     reasoning as the `InviteMemberDialog` this replaced (inviting two or
//     three people in a row is the common case, and closing on success would
//     make the second invitation cost a full reopen). The email field clears
//     itself and a confirmation line appears alongside the form, ready for
//     the next invite.

import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Plus } from "reicon-react";
import {
  createInvitation,
  type InvitationFormState,
} from "@/features/invitations/actions/create-invitation";
import { cn } from "@/shared/lib/cn";
import {
  DURATION,
  EASE_OUT_QUINT,
  LAYOUT_SPRING,
} from "@/shared/motion/tokens";
import { FormField } from "@/shared/ui/form-field";
import { PendingLabel } from "@/shared/ui/pending-label";
import { InlineMessage } from "@/shared/ui/state/inline-message";

const INITIAL_STATE: InvitationFormState = { status: "idle", message: "" };
const PANEL_LAYOUT_ID = "invite-popover-panel";

const PANEL_TRANSITION = { duration: DURATION.fast, ease: EASE_OUT_QUINT };

const TRIGGER_CLASSES =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90";

/** Isolated so only this button re-renders on pending changes (same pattern as the dialog this replaces). */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <PendingLabel
        pending={pending}
        idleLabel="Enviar invitación"
        pendingLabel="Enviando…"
      />
    </button>
  );
}

/**
 * Invites somebody without ever showing Clerk (docs/design.md, ADR-0013):
 * the "Invitar" trigger morphs into a compact panel anchored to it, instead
 * of opening a centered modal — a single email field is a small enough task
 * that a popover reads as more direct than a dialog.
 *
 * The same server action and validation as before (see
 * create-invitation.ts): the invite quota and audit trail still live only
 * in the Go API.
 */
export function InvitePopover() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createInvitation, INITIAL_STATE);
  const [email, setEmail] = useState("");
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const titleId = useId();
  const emailId = useId();
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const submittedEmailRef = useRef("");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setEmail("");
      setConfirmedEmail(null);
    }
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setConfirmedEmail(null);
  }

  const emailError = state.fieldErrors?.find(
    (error) => error.field === "email",
  )?.message;
  // A form-level message only when the failure didn't tie to the field
  // itself — the field's own error already says it there.
  const formError =
    state.status === "error" && !emailError ? state.message : undefined;

  useEffect(() => {
    if (state.status === "success" && open) {
      // The confirmation shows the email that was actually submitted, not
      // whatever is in the field by the time this effect runs.
      setConfirmedEmail(submittedEmailRef.current);
      setEmail("");
      router.refresh();
      return;
    }

    if (state.status === "error" && emailError) {
      emailInputRef.current?.focus();
    }
  }, [state, open, router, emailError]);

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange} modal>
      <Popover.Trigger asChild>
        <m.button
          type="button"
          layoutId={PANEL_LAYOUT_ID}
          transition={LAYOUT_SPRING}
          className={cn(
            TRIGGER_CLASSES,
            open && "pointer-events-none opacity-0",
          )}
        >
          <Plus size={16} aria-hidden="true" />
          Invitar
        </m.button>
      </Popover.Trigger>

      <AnimatePresence>
        {open ? (
          <Popover.Portal forceMount>
            <Popover.Content
              asChild
              forceMount
              role="dialog"
              aria-labelledby={titleId}
              align="end"
              sideOffset={10}
              collisionPadding={16}
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                emailInputRef.current?.focus();
              }}
            >
              <m.div
                layoutId={PANEL_LAYOUT_ID}
                transition={LAYOUT_SPRING}
                className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-5 shadow-2xl outline-none"
              >
                <m.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: PANEL_TRANSITION,
                  }}
                  className="flex flex-col gap-3"
                >
                  <div className="space-y-1">
                    <h2 id={titleId} className="text-sm font-bold text-ink">
                      Invitar a alguien
                    </h2>
                    <p className="text-xs text-ink-muted">
                      Solo se entra por invitación.
                    </p>
                  </div>

                  <form
                    onSubmit={() => {
                      submittedEmailRef.current = email;
                    }}
                    action={formAction}
                    className="flex flex-col gap-2"
                  >
                    <FormField
                      id={emailId}
                      label="Correo de la persona a la que invitas"
                      errorText={emailError}
                      labelClassName="text-xs"
                    >
                      {(aria) => (
                        <input
                          {...aria}
                          ref={emailInputRef}
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="amigo@correo.com"
                          value={email}
                          onChange={(event) =>
                            handleEmailChange(event.target.value)
                          }
                          className="rounded-lg border border-border bg-ground px-3 py-2 text-sm placeholder:text-ink-muted"
                        />
                      )}
                    </FormField>

                    {confirmedEmail ? (
                      <output className="text-xs text-success">
                        <span className="inline-flex items-center gap-1">
                          <Check
                            size={14}
                            aria-hidden="true"
                            className="text-success"
                          />
                          Invitación enviada a{" "}
                          <span className="font-medium">{confirmedEmail}</span>.
                        </span>
                      </output>
                    ) : null}

                    {formError ? (
                      <InlineMessage
                        tone="error"
                        afterUserAction
                        className="text-xs"
                      >
                        {formError}
                      </InlineMessage>
                    ) : null}

                    <div className="flex justify-end pt-1">
                      <SubmitButton />
                    </div>
                  </form>
                </m.div>
              </m.div>
            </Popover.Content>
          </Popover.Portal>
        ) : null}
      </AnimatePresence>
    </Popover.Root>
  );
}
