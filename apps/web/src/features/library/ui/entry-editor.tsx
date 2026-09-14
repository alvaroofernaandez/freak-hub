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
  type EntryPatch,
  type UpdateEntryFormState,
  updateLibraryEntry,
} from "@/features/library/actions/update-entry";
import type { LibraryItem } from "@/features/library/lib/library-item";
import {
  allowedTransitions,
  canRate,
} from "@/features/library/lib/transitions";
import type { LibraryEntryStatus, WorkCategory } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog } from "@/shared/ui/dialog";
import { PendingLabel } from "@/shared/ui/pending-label";
import { RadioChips } from "@/shared/ui/radio-chips";
import { InlineMessage } from "@/shared/ui/state/inline-message";
import { STATUS_ORDER } from "@/shared/ui/status-badge";

const MIN_RATING = 1;
const MAX_RATING = 10;

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

/**
 * The plural unit each category counts in, taken from the contract's own
 * description of `LibraryEntry.progress`. `film` and `tcg` are absent
 * because the contract names no unit for them — the figure stays bare
 * rather than being guessed at, exactly as `progressLabel` does.
 */
const PROGRESS_UNIT: Partial<Record<WorkCategory, string>> = {
  anime: "episodios",
  manga: "capítulos",
  game: "horas",
  boardgame: "partidas",
};

const FIELD_LABEL_CLASS =
  "font-mono text-[10px] uppercase tracking-[0.05em] text-ink-muted";

const INPUT_CLASS =
  "w-20 rounded-lg border border-border bg-surface px-3 py-2 text-center font-mono text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50";

const STEP_BUTTON_CLASS =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-ink-muted transition-colors duration-150 hover:border-ink-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2.5 text-sm text-ink-muted transition-colors duration-150 hover:border-ink-muted hover:text-ink";

type Draft = {
  status: LibraryEntryStatus;
  progress: number;
  rating: number | null;
  isFavourite: boolean;
  owned: boolean;
};

function draftOf(item: LibraryItem): Draft {
  return {
    status: item.status,
    progress: item.progress,
    rating: item.rating,
    isFavourite: item.isFavourite,
    owned: item.owned,
  };
}

/**
 * The diff, and the reason this component exists in the shape it does.
 *
 * `PATCH /v1/library/{id}` reads absent, `null` and a value as three
 * different instructions, so what gets sent has to be what actually moved.
 * A key that did not change is left out, which is what makes the contract's
 * subtler clauses hold by construction rather than by remembering:
 *
 * - a stored rating survives a status change, because a status change alone
 *   produces `{status}` and the rating is simply not in the body;
 * - re-sending the current status is a no-op, so an unchanged status is
 *   never sent at all;
 * - `false` and `null` are values, not absences, and only a strict
 *   comparison against what is stored keeps them from being dropped.
 */
export function buildPatch(item: LibraryItem, draft: Draft): EntryPatch {
  const patch: EntryPatch = {};

  if (draft.status !== item.status) {
    patch.status = draft.status;
  }
  if (draft.progress !== item.progress) {
    patch.progress = draft.progress;
  }
  if (draft.rating !== item.rating) {
    patch.rating = draft.rating;
  }
  if (draft.isFavourite !== item.isFavourite) {
    patch.is_favourite = draft.isFavourite;
  }
  if (draft.owned !== item.owned) {
    patch.owned = draft.owned;
  }

  return patch;
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
 * status the entry is actually in. The API is still the authority — it
 * answers `422 invalid_transition` whatever this renders — but an interface
 * that offers a move the domain will refuse has already failed by the time
 * that 422 arrives. Unavailable statuses are disabled rather than hidden,
 * and the reason is written out: the shape of the lifecycle is information
 * worth showing, and a list that silently shrinks teaches nothing.
 *
 * Note and dates stay read-only in `EntrySummary`. They are patchable by the
 * same endpoint and are simply out of this change's scope; showing them as
 * text is honest, showing them as dead controls would not be.
 */
export function EntryEditor({ item, children }: EntryEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftOf(item));
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
  const ratingHelpId = useId();
  const progressHelpId = useId();

  const reachable = allowedTransitions(item.status);
  const unavailable = STATUS_OPTIONS.map((option) => option.value).filter(
    (status) => status !== item.status && !reachable.includes(status),
  );
  const ratingAllowed = canRate(draft.status);
  const unit = PROGRESS_UNIT[item.category];
  const total = item.progressTotal;
  const patch = buildPatch(item, draft);
  const hasChanges = Object.keys(patch).length > 0;
  const busy = isSaving || isRemoving;

  // No optimistic update anywhere in this product: the server answers, and
  // only then does the page re-read itself (docs/states.md). A failed save
  // leaves the draft exactly as it was, so nothing typed is lost.
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

  function setStatus(status: LibraryEntryStatus) {
    setDraft((current) => ({ ...current, status }));
  }

  function stepProgress(delta: number) {
    setDraft((current) => ({
      ...current,
      progress: Math.max(0, current.progress + delta),
    }));
  }

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
            value={draft.status}
            onValueChange={setStatus}
            options={STATUS_OPTIONS}
            unavailable={unavailable}
            disabled={busy}
            describedBy={statusHelpId}
          />
          <p id={statusHelpId} className="text-xs text-ink-muted">
            {reachable.length === 0
              ? `Desde «${STATUS_LABELS[item.status]}» no hay ningún cambio de estado posible.`
              : `Desde «${STATUS_LABELS[item.status]}» solo puedes pasar a ${listOf(
                  reachable.map((status) => `«${STATUS_LABELS[status]}»`),
                )}.`}
          </p>
        </div>

        <div className="grid gap-[18px] sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="entry-progress" className={FIELD_LABEL_CLASS}>
              {unit ? `Progreso · ${unit}` : "Progreso"}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Restar uno al progreso"
                disabled={busy || draft.progress <= 0}
                onClick={() => stepProgress(-1)}
                className={STEP_BUTTON_CLASS}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <input
                id="entry-progress"
                type="number"
                inputMode="numeric"
                min={0}
                // A ceiling only when the catalogue gave one. An anime still
                // airing declares no episode count, and refusing episode 13
                // of a series that has aired 13 would be inventing a fact
                // nobody stated (domain rule 5).
                {...(total === null ? {} : { max: total })}
                value={draft.progress}
                disabled={busy}
                aria-describedby={progressHelpId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    progress: Math.max(
                      0,
                      Math.floor(Number(event.target.value) || 0),
                    ),
                  }))
                }
                className={INPUT_CLASS}
              />
              <button
                type="button"
                aria-label="Sumar uno al progreso"
                disabled={busy || (total !== null && draft.progress >= total)}
                onClick={() => stepProgress(1)}
                className={STEP_BUTTON_CLASS}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <p id={progressHelpId} className="text-xs text-ink-muted">
              {total === null
                ? `Un recuento, no un porcentaje. No sabemos cuántos ${unit ?? "unidades"} tiene en total.`
                : `Un recuento, no un porcentaje: de ${total} ${unit ?? ""}`.trim()}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="entry-rating" className={FIELD_LABEL_CLASS}>
              Valoración
            </label>
            <div className="flex items-center gap-2">
              <input
                id="entry-rating"
                type="number"
                inputMode="numeric"
                min={MIN_RATING}
                max={MAX_RATING}
                placeholder="—"
                value={draft.rating ?? ""}
                disabled={busy || !ratingAllowed}
                aria-describedby={ratingHelpId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    rating:
                      event.target.value === ""
                        ? null
                        : clamp(
                            Math.floor(Number(event.target.value)),
                            MIN_RATING,
                            MAX_RATING,
                          ),
                  }))
                }
                className={INPUT_CLASS}
              />
              <span className="font-mono text-sm text-ink-muted">/10</span>
              {draft.rating === null ? null : (
                <button
                  type="button"
                  disabled={busy || !ratingAllowed}
                  onClick={() =>
                    setDraft((current) => ({ ...current, rating: null }))
                  }
                  className={cn(
                    SECONDARY_BUTTON_CLASS,
                    "px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40",
                  )}
                >
                  Quitar la valoración
                </button>
              )}
            </div>
            <p id={ratingHelpId} className="text-xs text-ink-muted">
              {ratingAllowed
                ? "Del 1 al 10."
                : // The other half of the rule, said out loud: the stored
                  // score is not lost by moving out of completed, it is
                  // only frozen while the entry is somewhere else.
                  "Solo puedes valorar lo que has terminado o lo que has abandonado. La valoración que ya tengas se conserva."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            aria-pressed={draft.isFavourite}
            disabled={busy}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                isFavourite: !current.isFavourite,
              }))
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors duration-150",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              draft.isFavourite
                ? "border-accent bg-accent text-accent-ink"
                : "border-border text-ink-muted hover:border-ink-muted hover:text-ink",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Star size={14} aria-hidden="true" />
            Favorito
          </button>
          <Checkbox
            checked={draft.owned}
            disabled={busy}
            onCheckedChange={(owned) =>
              setDraft((current) => ({ ...current, owned }))
            }
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

      <RemoveDialog
        isOpen={confirmOpen}
        title={item.title}
        pending={isRemoving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => removeAction(item.id)}
      />
    </section>
  );
}

type RemoveDialogProps = {
  isOpen: boolean;
  title: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * The confirmation a `DELETE` earns here.
 *
 * Not a reflex: `DELETE /v1/library/{id}` is not idempotent, so there is no
 * "just do it again" to fall back on, and the entry carries a progress, a
 * score and a note that nothing else holds. The work itself survives in the
 * shared catalogue (domain rule 3), which the copy says, because "quitar"
 * reads like "delete forever" otherwise.
 */
function RemoveDialog({
  isOpen,
  title,
  pending,
  onCancel,
  onConfirm,
}: RemoveDialogProps) {
  const titleId = useId();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      titleId={titleId}
      maxWidthClassName="max-w-[460px]"
    >
      <h2 id={titleId} className="text-[17px] font-bold text-ink">
        ¿Quitar «{title}» de tu biblioteca?
      </h2>
      <p className="text-sm text-ink-muted">
        Perderás su estado, su progreso, su valoración y su nota. La obra se
        queda en el catálogo del grupo, así que puedes volver a añadirla.
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded-lg border border-danger/40 px-4 py-2.5 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PendingLabel
            pending={pending}
            idleLabel="Quitar la entrada"
            pendingLabel="Quitando…"
          />
        </button>
      </div>
    </Dialog>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** "«A», «B» o «C»" — the Spanish list, with the conjunction Intl gives. */
function listOf(items: string[]): string {
  return new Intl.ListFormat("es", {
    style: "long",
    type: "disjunction",
  }).format(items);
}
