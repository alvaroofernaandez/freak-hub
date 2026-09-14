"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import type { FieldValue } from "@/features/library/lib/entry-draft";

const LABEL_CLASS =
  "font-mono text-[10px] uppercase tracking-[0.05em] text-ink-muted";

const INPUT_CLASS =
  "w-20 rounded-lg border border-border bg-surface px-3 py-2 text-center font-mono text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid]:border-danger";

type EntryNumberFieldProps<T> = {
  id: string;
  label: string;
  /** What the box holds right now, exactly as typed. */
  text: string;
  onTextChange: (text: string) => void;
  /** The reading of `text`: a usable value, or why it is not one. */
  field: FieldValue<T>;
  /** Shown under the box while the reading succeeds. */
  helpText: string;
  disabled?: boolean;
  placeholder?: string;
  /** Rendered to the left of the box (the progress stepper's minus). */
  before?: ReactNode;
  /** Rendered to the right (the stepper's plus, the clear button, "/10"). */
  after?: ReactNode;
};

/**
 * One of the entry editor's two numeric boxes.
 *
 * Deliberately `type="text"` with `inputMode="numeric"`, never
 * `type="number"`. A number input sanitizes its own value: type `12e` and the
 * box still shows `12e` while `.value` reads the empty string. The editor's
 * previous version read that empty string and wrote `progress: 0` over a real
 * count, and `rating: null` over a real score, with nothing on screen
 * disagreeing — React's controlled value was `""` too, so it never repainted.
 * Reading the raw text is what makes the bad input visible, and
 * `lib/entry-draft.ts` is what decides whether it can be used.
 *
 * The same choice is why the bounds are checked in that module rather than
 * with `min`/`max` here: the panel saves from a click handler and never
 * submits a form, so the browser's constraint validation never runs and those
 * attributes would be decoration.
 */
export function EntryNumberField<T>({
  id,
  label,
  text,
  onTextChange,
  field,
  helpText,
  disabled,
  placeholder,
  before,
  after,
}: EntryNumberFieldProps<T>) {
  const helpId = useId();
  const errorId = useId();
  const invalid = field.kind === "invalid";

  return (
    <div className="space-y-2">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        {before}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : helpId}
          onChange={(event) => onTextChange(event.target.value)}
          className={INPUT_CLASS}
        />
        {after}
      </div>
      {invalid ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {field.message}
        </p>
      ) : (
        <p id={helpId} className="text-xs text-ink-muted">
          {helpText}
        </p>
      )}
    </div>
  );
}
