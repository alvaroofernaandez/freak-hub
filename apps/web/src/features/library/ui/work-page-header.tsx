import type { MockWork } from "@/features/library/lib/mock-works";
import { cn } from "@/shared/lib/cn";
import {
  CATEGORY_ACCENT_CLASS,
  CATEGORY_LABELS,
} from "@/shared/ui/category-stripe";

type WorkPageHeaderProps = {
  work: MockWork;
};

/**
 * Category-specific metadata line, e.g. "2019 · 40–70 min · 1–5 jugadores ·
 * Stonemaier Games" for a boardgame. Only boardgames carry these fields
 * today (docs/design/high-fidelity-desktop.html §4); other categories will
 * reuse this once their own metadata lands.
 */
function metadataLine(work: MockWork): string | null {
  const parts = [
    work.year ? String(work.year) : null,
    work.duration ?? null,
    work.players ?? null,
    work.publisher ?? null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * A work page's two-column header: a cover placeholder (no cover art yet,
 * see docs/roadmap.md) plus title, category pill, category-specific metadata
 * and source attribution (docs/design/high-fidelity-desktop.html §4).
 */
export function WorkPageHeader({ work }: WorkPageHeaderProps) {
  const metadata = metadataLine(work);

  return (
    <div className="flex flex-col gap-[22px] md:flex-row md:gap-[22px] lg:gap-[30px]">
      <div
        data-testid="work-page-header-cover"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--color-ground-deep), var(--color-ground-deep) 6px, var(--color-surface-raised) 6px, var(--color-surface-raised) 12px)",
        }}
        className="flex h-[220px] w-full flex-none items-center justify-center rounded-xl font-mono text-[11px] text-ink-faint md:h-[230px] md:w-[170px] lg:h-[300px] lg:w-[220px]"
      >
        portada
      </div>
      <div className="flex flex-col gap-2.5 md:gap-[9px] md:pt-1.5 lg:gap-3 lg:pt-2">
        <h1 className="text-2xl font-bold text-ink md:text-[23px] lg:text-3xl">
          {work.title}
        </h1>
        <span
          className={cn(
            "w-fit rounded-full border px-3 py-[5px] text-[11px] font-semibold md:px-[11px] md:py-1 md:text-[10px] lg:px-3 lg:py-[5px] lg:text-[11px]",
            CATEGORY_ACCENT_CLASS[work.category],
          )}
        >
          {CATEGORY_LABELS[work.category]}
        </span>
        {metadata ? (
          <p
            data-testid="work-page-header-metadata"
            className="text-xs text-ink-muted lg:text-[13px]"
          >
            {metadata}
          </p>
        ) : null}
        {work.source ? (
          <p className="font-mono text-[10px] text-ink-faint lg:text-[11px]">
            Fuente: {work.source}
          </p>
        ) : null}
      </div>
    </div>
  );
}
