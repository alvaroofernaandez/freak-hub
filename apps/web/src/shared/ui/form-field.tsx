import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface FieldAria {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

interface FormFieldProps {
  id: string;
  label: string;
  helperText?: string;
  /** A field error from the Problem's `field_errors` (ADR-0014), already
   * resolved to display copy via `shared/errors/messages.ts`. Only ever
   * shown after a submit — never invented client-side wording that
   * disagrees with the backend. */
  errorText?: string;
  className?: string;
  labelClassName?: string;
  /** Render-prop instead of `cloneElement`: the field itself (`<input>`,
   * `<textarea>`, a file input…) varies enough between call sites that
   * wiring `id`/`aria-invalid`/`aria-describedby` explicitly is clearer
   * than guessing at a child element's props. */
  children: (aria: FieldAria) => ReactNode;
}

/**
 * The one field wrapper every form in the product builds on
 * (docs/states.md): label → field → optional helper → optional error, with
 * the field pointing at both via `aria-describedby` and `aria-invalid` set
 * only when there is something to flag. `invitation-form.tsx`,
 * `invite-popover.tsx` and `edit-profile-dialog.tsx` all share this instead
 * of each re-deriving the same wiring.
 */
export function FormField({
  id,
  label,
  helperText,
  errorText,
  className,
  labelClassName,
  children,
}: FormFieldProps) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = errorText ? `${id}-error` : undefined;
  const describedBy =
    [helperId, errorId].filter(Boolean).join(" ") || undefined;

  const aria: FieldAria = {
    id,
    ...(errorText ? { "aria-invalid": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className={cn("text-sm text-ink-muted", labelClassName)}
      >
        {label}
      </label>
      {children(aria)}
      {helperText ? (
        <p id={helperId} className="text-xs text-ink-muted">
          {helperText}
        </p>
      ) : null}
      {errorText ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
