"use client";

import { useId } from "react";
import { Dialog } from "@/shared/ui/dialog";
import { PendingLabel } from "@/shared/ui/pending-label";

type RemoveEntryDialogProps = {
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
export function RemoveEntryDialog({
  isOpen,
  title,
  pending,
  onCancel,
  onConfirm,
}: RemoveEntryDialogProps) {
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
