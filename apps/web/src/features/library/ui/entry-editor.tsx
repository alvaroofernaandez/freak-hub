"use client";

import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useActionState,
  useEffect,
  useId,
  useState,
} from "react";
import { Minus, Plus, Star, Trash } from "reicon-react";
import {
  type RemoveEntryFormState,
  removeLibraryEntry,
} from "@/features/library/actions/remove-entry";
import {
  type UpdateEntryFormState,
  updateLibraryEntry,
} from "@/features/library/actions/update-entry";
import {
  buildPatch,
  MAX_RATING,
  MIN_RATING,
  readProgress,
  readRating,
} from "@/features/library/lib/entry-draft";
import {
  type LibraryItem,
  PROGRESS_UNIT,
} from "@/features/library/lib/library-item";
import {
  allowedTransitions,
  canRate,
} from "@/features/library/lib/transitions";
import { EntryNumberField } from "@/features/library/ui/entry-number-field";
import { RemoveEntryDialog } from "@/features/library/ui/remove-entry-dialog";
import type { LibraryEntryStatus } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { Checkbox } from "@/shared/ui/checkbox";
import { PendingLabel } from "@/shared/ui/pending-label";
import { RadioChips } from "@/shared/ui/radio-chips";
import { InlineMessage } from "@/shared/ui/state/inline-message";
import { STATUS_ORDER } from "@/shared/ui/status-badge";

const UPDATE_IDLE: UpdateEntryFormState = { status: "idle", message: "" };
const REMOVE_IDLE: RemoveEntryFormState = { status: "idle", message: "" };

const STATUS_OPTIONS = STATUS_ORDER.map(({ status, Icon, label }) => ({
  value: status,
  label,
  Icon,
}));

const STATUS_LABELS = Object.fromEntries(
  STATUS_ORDER.map(({ status, label }) => [status, label]),
) as Record<LibraryEntryStatus, string>;

const FIELD_LABEL_CLASS =
  "font-mono text-[10px] uppercase tracking-[0.05em] text-ink-muted";

const STEP_BUTTON_CLASS =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-ink-muted transition-colors duration-150 hover:border-ink-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

const SMALL_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-ink-muted transition-colors duration-150 hover:border-ink-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

function ratingTextOf(rating: number | null): string {
  return rating === null ? "" : String(rating);
}

type EntryEditorProps = {
  item: LibraryItem;
  /** The read-only tail of the same panel (`EntrySummary`: the dates and the
   * note). It renders inside this card rather than beside it, because one
   * entry is one panel in the mockup, and a card nested in a card is never
   * the right answer. */
  children?: ReactNode;
};

/**
 * "Tu entrada", as the mockup draws it
 * (docs/design/high-fidelity-desktop.html §4): status, progress, rating,
 * favourite and ownership, with one Guardar for the lot.
 *
 * It was read-only through the read half of issue #73, because there was no
 * write path and a status chip that looks pressable but changes nothing is a
 * false affordance. This is that write path.
 *
 * The status chips offer only the moves docs/domain.md draws out of the
 * status the entry is actually in (ADR-0016). The API is still the authority
 * — it answers `422 invalid_transition` whatever this renders — but an
 * interface that offers a move the domain will refuse has already failed by
 * the time that 422 arrives. Unavailable statuses are disabled rather than
 * hidden, and the reason is written out: the shape of the lifecycle is
 * information worth showing, and a list that silently shrinks teaches
 * nothing.
 *
 * The two numeric fields are plain text, not `<input type="number">`, and
 * every rule about what they may hold lives in `lib/entry-draft.ts`. Both
 * decisions come from the same bug: a number input hides unreadable text
 * behind an empty `.value`, so `12e` silently became `progress: 0`, and
 * `min`/`max` on the element were decorative because this panel saves from a
 * click handler and never submits a form. Reading the text ourselves is what
 * lets an out-of-range count be refused here instead of at the API.
 *
 * Note and dates stay read-only in `EntrySummary`. They are patchable by the
 * same endpoint and are simply out of this change's scope; showing them as
 * text is honest, showing them as dead controls would not be.
 */
export function EntryEditor({ item, children }: EntryEditorProps) {
  const router = useRouter();
  const [status, setStatus] = useState<LibraryEntryStatus>(item.status);
  const [progressText, setProgressText] = useState(String(item.progress));
  const [ratingText, setRatingText] = useState(ratingTextOf(item.rating));
  const [isFavourite, setIsFavourite] = useState(item.isFavourite);
  const [owned, setOwned] = useState(item.owned);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updateState, saveAction, isSaving] = useActionState(
    updateLibraryEntry,
    UPDATE_IDLE,
  );
  const [removeState, removeAction, isRemoving] = useActionState(
    removeLibraryEntry,
    REMOVE_IDLE,
  );
  const statusHelpId = useId();

  const reachable = allowedTransitions(item.status);
  const unavailable = STATUS_OPTIONS.map((option) => option.value).filter(
    (option) => option !== item.status && !reachable.includes(option),
  );
  const ratingAllowed = canRate(status);
  const unit = PROGRESS_UNIT[item.category]?.many;
  const total = item.progressTotal;
  const busy = isSaving || isRemoving;

  const progressField = readProgress(progressText, total);
  const ratingField = readRating(ratingText);
  const readable =
    progressField.kind === "value" && ratingField.kind === "value";
  const patch = readable
    ? buildPatch(item, {
        status,
        progress: progressField.value,
        rating: ratingField.value,
        isFavourite,
        owned,
      })
    : {};
  const hasChanges = Object.keys(patch).length > 0;

  // No optimistic update anywhere in this product: the server answers, and
  // only then does the page re-read itself (docs/states.md). A failed save
  // leaves every field exactly as it was, so nothing typed is lost.
  useEffect(() => {
    if (updateState.status === "success") {
      router.refresh();
    }
  }, [updateState, router]);

  useEffect(() => {
    if (removeState.status === "success") {
      setConfirmOpen(false);
      // The entry is gone, so the page it was on is a 404 now. Repeating the
      // delete would be a 404 too — it is not idempotent — so the interface
      // leaves rather than offering to try again. `replace`, not `push`: the
      // back button should not walk into a page that no longer exists.
      router.replace(`/biblioteca/${item.category}`);
      router.refresh();
    }
  }, [removeState, router, item.category]);

  function chooseStatus(next: LibraryEntryStatus) {
    setStatus(next);

    // Moving somewhere a score cannot be given puts back the score that is
    // stored, so the greyed-out box never shows a number the save is quietly
    // dropping. A cleared box is left alone: `rating: null` is accepted in
    // any status, so an explicit clear survives the move.
    const pending = readRating(ratingText);
    const clearing = pending.kind === "value" && pending.value === null;

    if (!canRate(next) && !clearing) {
      setRatingText(ratingTextOf(item.rating));
    }
  }

  function stepProgress(delta: number) {
    const current = readProgress(progressText, total);
    const from = current.kind === "value" ? current.value : item.progress;
    const next = Math.max(0, from + delta);

    setProgressText(String(total === null ? next : Math.min(total, next)));
  }

  const steppable = progressField.kind === "value";
  const progressValue = steppable ? progressField.value : item.progress;

  return (
    <section className="rounded-2xl border border-border bg-surface-raised p-5 md:p-[22px]">
      <h2 className="text-[15px] font-bold text-ink">Tu entrada</h2>

      <div className="mt-[18px] space-y-[18px]">
        <div className="space-y-2">
          {/* `aria-hidden`: `RadioChips` already names the group "Estado"
              for assistive tech, and announcing it twice is noise. This is
              the visible half of the same label. */}
          <p aria-hidden="true" className={FIELD_LABEL_CLASS}>
            Estado
          </p>
          <RadioChips
            label="Estado"
            value={status}
            onValueChange={chooseStatus}
            options={STATUS_OPTIONS}
            unavailable={unavailable}
            disabled={busy}
            describedBy={statusHelpId}
          />
          <p id={statusHelpId} className="text-xs text-ink-muted">
            {reachable.length === 0
              ? `Desde «${STATUS_LABELS[item.status]}» no hay ningún cambio de estado posible.`
              : `Desde «${STATUS_LABELS[item.status]}» solo puedes pasar a ${listOf(
                  reachable.map((option) => `«${STATUS_LABELS[option]}»`),
                )}.`}
          </p>
        </div>

        <div className="grid gap-[18px] sm:grid-cols-2">
          <EntryNumberField
            id="entry-progress"
            label={unit ? `Progreso · ${unit}` : "Progreso"}
            text={progressText}
            onTextChange={setProgressText}
            field={progressField}
            disabled={busy}
            helpText={
              total === null
                ? `Un recuento, no un porcentaje. No sabemos cuántos ${unit ?? "en total"} tiene.`
                : `Un recuento, no un porcentaje: de ${total} ${unit ?? ""}`.trim()
            }
            before={
              <button
                type="button"
                aria-label="Restar uno al progreso"
                disabled={busy || !steppable || progressValue <= 0}
                onClick={() => stepProgress(-1)}
                className={STEP_BUTTON_CLASS}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
            }
            after={
              <button
                type="button"
                aria-label="Sumar uno al progreso"
                disabled={
                  busy ||
                  !steppable ||
                  (total !== null && progressValue >= total)
                }
                onClick={() => stepProgress(1)}
                className={STEP_BUTTON_CLASS}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            }
          />

          <EntryNumberField
            id="entry-rating"
            label="Valoración"
            text={ratingText}
            onTextChange={setRatingText}
            field={ratingField}
            placeholder="—"
            disabled={busy || !ratingAllowed}
            helpText={
              ratingAllowed
                ? `Del ${MIN_RATING} al ${MAX_RATING}.`
                : // The other half of the rule, said out loud: the stored
                  // score is not lost by moving out of completed, it is only
                  // frozen while the entry is somewhere else. Clearing stays
                  // available, which is what the contract allows always.
                  "Solo puedes valorar lo que has terminado o lo que has abandonado. La que ya tengas se conserva, y quitarla puedes en cualquier momento."
            }
            after={
              <>
                <span className="font-mono text-sm text-ink-muted">/10</span>
                {ratingText === "" ? null : (
                  <button
                    type="button"
                    // Enabled whatever the status: the contract says `null`
                    // clears a rating and is "always allowed", so the one way
                    // out of a score must not be locked behind the statuses
                    // that can set one.
                    disabled={busy}
                    onClick={() => setRatingText("")}
                    className={SMALL_BUTTON_CLASS}
                  >
                    Quitar la valoración
                  </button>
                )}
              </>
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            aria-pressed={isFavourite}
            disabled={busy}
            onClick={() => setIsFavourite((current) => !current)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors duration-150",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              isFavourite
                ? "border-accent bg-accent text-accent-ink"
                : "border-border text-ink-muted hover:border-ink-muted hover:text-ink",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Star size={14} aria-hidden="true" />
            Favorito
          </button>
          <Checkbox
            checked={owned}
            disabled={busy}
            onCheckedChange={setOwned}
            label="Lo tengo en propiedad"
          />
        </div>

        {updateState.status === "success" ? (
          <InlineMessage tone="success">{updateState.message}</InlineMessage>
        ) : null}
        {updateState.status === "error" ? (
          <InlineMessage tone="error" afterUserAction>
            {updateState.message}
          </InlineMessage>
        ) : null}
        {removeState.status === "error" ? (
          <InlineMessage tone="error" afterUserAction>
            {removeState.message}
          </InlineMessage>
        ) : null}

        {children}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-[18px]">
          <button
            type="button"
            disabled={busy || !hasChanges}
            onClick={() => saveAction({ id: item.id, patch })}
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PendingLabel
              pending={isSaving}
              idleLabel="Guardar cambios"
              pendingLabel="Guardando…"
            />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-danger/40 px-3.5 py-2.5 text-sm font-medium text-danger",
              "transition-colors duration-150 hover:bg-danger-soft",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Trash size={15} aria-hidden="true" />
            Quitar de mi biblioteca
          </button>
        </div>
      </div>

      <RemoveEntryDialog
        isOpen={confirmOpen}
        title={item.title}
        pending={isRemoving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => removeAction(item.id)}
      />
    </section>
  );
}

/** "«A», «B» o «C»" — the Spanish list, with the conjunction Intl gives. */
function listOf(items: string[]): string {
  return new Intl.ListFormat("es", {
    style: "long",
    type: "disjunction",
  }).format(items);
}
