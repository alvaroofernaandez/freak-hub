"use client";

import {
  type FormEvent,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createManualEntry,
  type ManualEntryFormState,
} from "@/features/library/actions/create-manual-entry";
import type { LibraryEntryStatus, WorkCategory } from "@/shared/api/types";
import { FormField } from "@/shared/ui/form-field";
import { PendingLabel } from "@/shared/ui/pending-label";
import { RadioChips } from "@/shared/ui/radio-chips";
import { InlineMessage } from "@/shared/ui/state/inline-message";
import { STATUS_ORDER } from "@/shared/ui/status-badge";

/** Mirrors the bounds `CreateWorkRequest` declares, so the browser refuses
 * an over-long title before the action has to. */
const TITLE_MAX = 300;
const SYNOPSIS_MAX = 5000;
const YEAR_MIN = 1800;
const YEAR_MAX = 2200;

const INITIAL_STATE: ManualEntryFormState = { status: "idle", message: "" };

const FIELD_CLASS =
  "rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted";

const LABEL_CLASS =
  "font-mono text-xs uppercase tracking-widest text-ink-muted";

const STATUS_OPTIONS = STATUS_ORDER.map(({ status, Icon, label }) => ({
  value: status,
  label,
  Icon,
}));

type ManualAddFormProps = {
  category: WorkCategory;
};

/**
 * Manual entry, for what the catalogue search does not find
 * (docs/design/high-fidelity-desktop.html §7). Until the write half of issue
 * #73 this was the same fields with a `disabled` button and no action behind
 * it.
 *
 * The status picker is the field the mockup does not draw, and it is not
 * optional: `CreateLibraryEntryRequest.status` is required and has no
 * default. Nothing starts selected, for the reason the contract gives for
 * having no default — wanting something, already owning it and having
 * finished it years ago are all equally normal ways to start, so picking one
 * for somebody would be guessing. All six are offered because creating an
 * entry is the entry point into the lifecycle, not a transition.
 *
 * Submission goes through `onSubmit` rather than `<form action>`: React
 * resets uncontrolled fields the moment an action bound to `action` settles,
 * success or not, which would empty a four-field form right after a
 * recoverable failure (docs/states.md).
 */
export function ManualAddForm({ category }: ManualAddFormProps) {
  const [state, formAction, isPending] = useActionState(
    createManualEntry,
    INITIAL_STATE,
  );
  const [status, setStatus] = useState<LibraryEntryStatus | "">("");
  const titleRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const synopsisRef = useRef<HTMLTextAreaElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const errorFor = (field: string) =>
    state.fieldErrors?.find((error) => error.field === field)?.message;
  const titleError = errorFor("title");
  const yearError = errorFor("year");
  const synopsisError = errorFor("synopsis");
  const statusError = errorFor("status");
  // A form-level message only when the failure did not tie to a field — the
  // field's own error already says it there.
  const formError =
    state.status === "error" &&
    !titleError &&
    !yearError &&
    !synopsisError &&
    !statusError
      ? state.message
      : undefined;

  useEffect(() => {
    if (state.status !== "error") {
      return;
    }
    // Visual order, so the focus lands on the first thing to fix. The status
    // picker is last visually but the likeliest to be at fault on a first
    // try, because it starts with nothing chosen; a radio group has no single
    // focusable element of its own, so this reaches for the first chip that
    // can actually take focus.
    if (titleError) {
      titleRef.current?.focus();
    } else if (yearError) {
      yearRef.current?.focus();
    } else if (synopsisError) {
      synopsisRef.current?.focus();
    } else if (statusError) {
      statusRef.current
        ?.querySelector<HTMLElement>('[role="radio"]:not([disabled])')
        ?.focus();
    }
  }, [state, titleError, yearError, synopsisError, statusError]);

  // The work reached the catalogue but its entry did not. A second
  // submission is a second work, and works are never deleted (domain rule 3),
  // so the button goes down and stays down: the message says not to press
  // again, and this is what makes that more than a request.
  const orphanedWork = state.workCreated === true;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (orphanedWork) {
      return;
    }

    const data = new FormData(event.currentTarget);
    data.set("category", category);
    data.set("status", status);
    formAction(data);
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="manual-add-form"
      className="flex max-w-[520px] flex-col gap-4"
    >
      <FormField
        id="title"
        label="Título"
        labelClassName={LABEL_CLASS}
        errorText={titleError}
      >
        {(aria) => (
          <input
            {...aria}
            ref={titleRef}
            name="title"
            type="text"
            required
            maxLength={TITLE_MAX}
            placeholder="Escribe el título…"
            className={FIELD_CLASS}
          />
        )}
      </FormField>

      <FormField
        id="year"
        label="Año"
        labelClassName={LABEL_CLASS}
        errorText={yearError}
      >
        {(aria) => (
          <input
            {...aria}
            ref={yearRef}
            name="year"
            type="number"
            inputMode="numeric"
            min={YEAR_MIN}
            max={YEAR_MAX}
            placeholder="aaaa"
            className={`${FIELD_CLASS} font-mono`}
          />
        )}
      </FormField>

      <FormField
        id="synopsis"
        label="Sinopsis"
        labelClassName={LABEL_CLASS}
        errorText={synopsisError}
      >
        {(aria) => (
          <textarea
            {...aria}
            ref={synopsisRef}
            name="synopsis"
            rows={4}
            maxLength={SYNOPSIS_MAX}
            className={FIELD_CLASS}
          />
        )}
      </FormField>

      <FormField
        id="status"
        label="Estado"
        labelClassName={LABEL_CLASS}
        helperText="En qué punto estás con esta obra. Puedes cambiarlo luego desde su ficha."
        errorText={statusError}
      >
        {(aria) => (
          <div ref={statusRef}>
            <RadioChips
              label="Estado"
              value={status}
              onValueChange={setStatus}
              options={STATUS_OPTIONS}
              disabled={isPending || orphanedWork}
              describedBy={aria["aria-describedby"]}
            />
          </div>
        )}
      </FormField>

      {formError ? (
        <InlineMessage tone="error" afterUserAction>
          {formError}
        </InlineMessage>
      ) : null}

      <button
        type="submit"
        disabled={isPending || orphanedWork}
        className="self-start rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PendingLabel
          pending={isPending}
          idleLabel="Guardar"
          pendingLabel="Guardando…"
        />
      </button>
    </form>
  );
}
