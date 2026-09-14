import type { EntryPatch } from "@/features/library/actions/update-entry";
import type { LibraryItem } from "@/features/library/lib/library-item";
import { canRate } from "@/features/library/lib/transitions";
import type { LibraryEntryStatus } from "@/shared/api/types";

/**
 * What one text field in the editor currently holds: a usable value, or a
 * reason it cannot be used.
 *
 * There is deliberately no third "empty" branch. An unreadable field is not
 * a smaller kind of value that the editor may quietly fill in with a
 * fallback; it is a field that cannot be saved yet, and saying so is the
 * whole job of this type.
 */
export type FieldValue<T> =
  | { kind: "value"; value: T }
  | { kind: "invalid"; message: string };

/** The editor's state once both numeric fields have been read successfully. */
export type ParsedDraft = {
  status: LibraryEntryStatus;
  progress: number;
  rating: number | null;
  isFavourite: boolean;
  owned: boolean;
};

export const MIN_RATING = 1;
export const MAX_RATING = 10;

/**
 * Digits and nothing else. `Number()` is far too permissive for a field a
 * person types into: it accepts `"12e3"`, `" 12 "`, `"0x10"`, `"Infinity"`
 * and `""`, and turns the last one into `0`. A count is a run of ASCII
 * digits or it is not a count.
 *
 * `\d` rather than a Unicode-aware class on purpose: Arabic-Indic digits
 * render as numerals but `Number("٣")` is `3` only by accident of the
 * runtime, and the API would receive something the person cannot verify by
 * reading their own field back.
 */
const DIGITS = /^\d+$/;

/**
 * Reads the progress box.
 *
 * These fields used to be `<input type="number">`, and that is what made
 * this a data-loss bug rather than a typo. HTML's value sanitization leaves
 * `.value` as the empty string for anything it cannot parse — `12e`, `2.5`,
 * `1 2` — while the box keeps showing what was typed. The old handler read
 * that empty string, ran it through `Number(...) || 0`, and wrote a
 * deliberate `progress: 0` over 47 watched episodes. React never repainted,
 * because its controlled value was `""` too, so nothing on screen disagreed.
 *
 * The fields are plain text now (`inputMode="numeric"` keeps the phone
 * keypad), so the unreadable input arrives here intact and is refused.
 * jsdom implements none of that sanitization, which is exactly why no test
 * could catch the old version and every case above is a test here.
 */
export function readProgress(
  text: string,
  total: number | null,
): FieldValue<number> {
  const trimmed = text.trim();

  if (trimmed === "") {
    return { kind: "invalid", message: "Escribe un número." };
  }

  if (!DIGITS.test(trimmed)) {
    return {
      kind: "invalid",
      message: "El progreso es un número entero, sin decimales ni signos.",
    };
  }

  const value = Number(trimmed);

  // The ceiling only exists when the catalogue declared one (domain rule 5).
  // `min`/`max` on the element itself would be decorative here: the editor
  // saves from a `type="button"` handler, never from a form submission, so
  // the browser's own constraint validation never runs.
  if (total !== null && value > total) {
    return {
      kind: "invalid",
      message: `Esta obra tiene ${total} en total, así que el progreso no puede pasar de ahí.`,
    };
  }

  return { kind: "value", value };
}

/**
 * Reads the rating box. An empty box is no score, which is a value; anything
 * unreadable is refused rather than being treated as one, because "clear the
 * rating" is a deliberate act and `rating: null` erases data on the server.
 */
export function readRating(text: string): FieldValue<number | null> {
  const trimmed = text.trim();

  if (trimmed === "") {
    return { kind: "value", value: null };
  }

  if (!DIGITS.test(trimmed)) {
    return {
      kind: "invalid",
      message: "La valoración es un número entero.",
    };
  }

  const value = Number(trimmed);

  if (value < MIN_RATING || value > MAX_RATING) {
    return {
      kind: "invalid",
      message: `La valoración va del ${MIN_RATING} al ${MAX_RATING}.`,
    };
  }

  return { kind: "value", value };
}

/**
 * The diff that goes out as the `PATCH` body.
 *
 * `PATCH /v1/library/{id}` reads absent, `null` and a value as three
 * different instructions, so only what actually moved travels. That one rule
 * is what makes two of the contract's subtler clauses hold by construction:
 * re-sending the current status never happens, and a stored rating survives a
 * status change because a status change alone produces `{status}` and the
 * score is simply not in the body.
 *
 * The rating clause it does *not* cover on its own is the one below, and
 * that gap was a real bug: the diff is necessary but not sufficient.
 */
export function buildPatch(item: LibraryItem, draft: ParsedDraft): EntryPatch {
  const patch: EntryPatch = {};

  if (draft.status !== item.status) {
    patch.status = draft.status;
  }
  if (draft.progress !== item.progress) {
    patch.progress = draft.progress;
  }
  if (draft.isFavourite !== item.isFavourite) {
    patch.is_favourite = draft.isFavourite;
  }
  if (draft.owned !== item.owned) {
    patch.owned = draft.owned;
  }

  if (draft.rating !== item.rating) {
    // The API validates an incoming rating against the status the entry ends
    // up in, not the one it came from, and it does it inside the same atomic
    // request as the transition. So a score typed while the entry was
    // `completed`, carried along by a move to `in_progress`, does not just
    // fail on its own: the `422 rating_not_allowed` takes the status change
    // down with it, and the person is left behind a greyed-out field with no
    // way forward.
    //
    // Clearing is the exception the contract states outright: `null` is
    // accepted in any status, so it always travels.
    if (draft.rating === null || canRate(draft.status)) {
      patch.rating = draft.rating;
    }
  }

  return patch;
}
