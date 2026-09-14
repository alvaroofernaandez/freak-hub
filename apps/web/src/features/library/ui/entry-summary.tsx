import type { ReactNode } from "react";
import { Box, Star } from "reicon-react";
import {
  type LibraryItem,
  progressLabel,
  progressPercentage,
} from "@/features/library/lib/library-item";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { StatusBadge } from "@/shared/ui/status-badge";
import { StatusMark } from "@/shared/ui/status-mark";

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
 * "Tu entrada" as the work page can honestly show it today
 * (docs/design/high-fidelity-desktop.html §4): every field the contract
 * stores, read-only.
 *
 * The mockup draws these as controls with a Guardar button. They are not
 * controls yet, and a status chip that looks pressable but changes nothing
 * is the same false affordance the "+1" on the home rail was removed for
 * (docs/design.md, 2026-09-10). `PATCH /v1/library/{id}` is wired in the
 * write half of issue #73; until then this reads.
 */
export function EntrySummary({ item }: EntrySummaryProps) {
  const percentage = progressPercentage(item);
  const progress = progressLabel(item);

  return (
    <section className="rounded-2xl border border-border bg-surface-raised p-5 md:p-[22px]">
      <h2 className="text-[15px] font-bold text-ink">Tu entrada</h2>
      <dl className="mt-[18px] grid grid-cols-1 gap-[18px] sm:grid-cols-2">
        <Field label="Estado">
          <StatusBadge status={item.status} />
        </Field>

        <Field label="Valoración" testId="entry-summary-rating">
          {item.rating === null ? (
            <span className="text-ink-muted">Sin valorar</span>
          ) : (
            <span className="font-mono">{item.rating}/10</span>
          )}
        </Field>

        <Field label="Progreso" testId="entry-summary-progress">
          {progress ? (
            <span className="font-mono">{progress}</span>
          ) : (
            <span className="text-ink-muted">Sin empezar</span>
          )}
          {percentage === null ? null : (
            <span className="mt-2 block">
              <ProgressBar
                value={percentage}
                label={`Progreso de ${item.title}`}
              />
            </span>
          )}
        </Field>

        {item.isFavourite || item.owned ? (
          <Field label="Marcas">
            <span className="flex flex-wrap items-center gap-4">
              {item.isFavourite ? (
                <StatusMark Icon={Star} label="Favorito" />
              ) : null}
              {item.owned ? (
                <StatusMark Icon={Box} label="En propiedad" />
              ) : null}
            </span>
          </Field>
        ) : null}

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

      {item.note === null ? null : (
        <div className="mt-[18px] space-y-2 border-t border-border-soft pt-[18px]">
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
    </section>
  );
}
