import { Download, Trash } from "reicon-react";

/**
 * Export and delete your own data (docs/product.md, principle 2).
 *
 * Neither does anything yet: the API exposes no endpoint for either
 * (docs/roadmap.md). They stay on screen, switched off, with the reason
 * written next to them — the same honesty `/anadir/[categoria]` uses for its
 * disabled search field. A button that pretends to export and quietly does
 * nothing would be worse than no button at all.
 */
const NOTE_ID = "settings-data-note";

const BUTTON_CLASS =
  "inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

export function DataControls() {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled
          aria-describedby={NOTE_ID}
          className={`${BUTTON_CLASS} border-border text-ink`}
        >
          <Download size={16} aria-hidden="true" />
          Exportar mis datos
        </button>
        <button
          type="button"
          disabled
          aria-describedby={NOTE_ID}
          className={`${BUTTON_CLASS} border-danger/40 text-danger hover:bg-danger-soft`}
        >
          <Trash size={16} aria-hidden="true" />
          Borrar mis datos
        </button>
      </div>

      <p id={NOTE_ID} className="max-w-[62ch] text-sm text-ink-muted">
        Los dos están apagados porque todavía no existen: la API no expone ni la
        exportación ni el borrado. Siguen aquí, a la vista, porque son un
        compromiso del producto y no una idea suelta; se encenderán en este
        mismo sitio cuando el servidor pueda cumplirlos.
      </p>
    </div>
  );
}
