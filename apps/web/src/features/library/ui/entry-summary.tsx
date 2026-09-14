import type { ReactNode } from "react";
import type { LibraryItem } from "@/features/library/lib/library-item";

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

type FieldProps = {
  label: string;
  children: ReactNode;
  testId?: string;
};

function Field({ label, children, testId }: FieldProps) {
  return (
    <div className="space-y-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </dt>
      <dd data-testid={testId} className="text-sm text-ink">
        {children}
      </dd>
    </div>
  );
}

type EntrySummaryProps = {
  item: LibraryItem;
};

/**
 * The read-only tail of "Tu entrada": the two dates and the note.
 *
 * Everything above it — status, progress, rating, favourite, ownership — is
 * a control now, in `EntryEditor`. These four fields are not, and the
 * distinction is deliberate rather than unfinished: they are patchable by
 * the same `PATCH /v1/library/{id}`, and wiring them is simply outside the
 * write half of issue #73. Shown as text they state a fact; shown as inputs
 * with a Guardar that ignored them they would lie.
 *
 * It renders no card of its own. It is nested inside the editor's panel, and
 * a card inside a card is always the wrong answer — this is a section of one
 * panel, separated by a rule, not a second thing on the page.
 */
export function EntrySummary({ item }: EntrySummaryProps) {
  const hasDates = item.startedAt !== null || item.finishedAt !== null;

  if (!hasDates && item.note === null) {
    return null;
  }

  return (
    <div className="space-y-[18px] border-t border-border-soft pt-[18px]">
      {hasDates ? (
        <dl className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
          {item.startedAt === null ? null : (
            <Field label="Fecha de inicio">
              <span className="font-mono text-[13px]">
                {formatDate(item.startedAt)}
              </span>
            </Field>
          )}
          {item.finishedAt === null ? null : (
            <Field label="Fecha de fin">
              <span className="font-mono text-[13px]">
                {formatDate(item.finishedAt)}
              </span>
            </Field>
          )}
        </dl>
      ) : null}

      {item.note === null ? null : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.05em] text-ink-muted">
              Nota
            </h3>
            {/* ADR-0005: a note has no per-entry privacy setting, so the page
                says who can read it before anybody is surprised by it. */}
            <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.03em] text-ink-muted">
              Nota pública para el grupo
            </span>
          </div>
          <p className="text-sm text-ink">{item.note}</p>
        </div>
      )}
    </div>
  );
}
