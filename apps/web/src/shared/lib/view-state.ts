import type { NormalizedAppError } from "@/shared/errors/types";

/**
 * The result shape for anything that loads data server-side (a page, a
 * section), instead of boolean soup (`loading`/`error`/`data` flags that can
 * disagree with each other). Exactly one of the three is ever true, and
 * TypeScript enforces it.
 */
export type ViewState<T> =
  | { status: "ready"; data: T }
  /** Loaded successfully, but there is genuinely nothing to show — distinct
   * from `error`. `reason` feeds `EmptyState`'s reason-specific copy
   * (first-use / collection / no-results / filtered / done). */
  | { status: "empty"; reason?: string }
  | { status: "error"; error: NormalizedAppError };

export function isReady<T>(
  state: ViewState<T>,
): state is { status: "ready"; data: T } {
  return state.status === "ready";
}

export function isEmpty<T>(
  state: ViewState<T>,
): state is { status: "empty"; reason?: string } {
  return state.status === "empty";
}

export function isError<T>(
  state: ViewState<T>,
): state is { status: "error"; error: NormalizedAppError } {
  return state.status === "error";
}

/**
 * A `NormalizedAppError`, stripped down to what can actually cross a Server
 * Action boundary as a plain, serializable object (no class instances, no
 * `recovery`'s function-shaped variants beyond their literal `kind`).
 * Server Action result types (`InvitationFormState`, `ProfileFormState`,
 * …) can embed this instead of inventing their own error shape.
 */
export interface SerializableActionError {
  status: "error";
  message: string;
  fieldErrors?: Record<string, string>;
}
