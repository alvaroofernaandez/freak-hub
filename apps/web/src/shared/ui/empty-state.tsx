import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Moulding } from "./moulding";

export type EmptyStateSize = "section" | "inline";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  /** `"section"` (default): a category or a whole page with nothing in it
   * yet, full treatment with the moulding. `"inline"`: a reason-specific
   * result — a search or a filter combination that matched nothing — sitting
   * inside content that already has its own chrome (the filter bar stays
   * above it), so it drops the moulding and the page-sized padding instead
   * of repeating them. */
  size?: EmptyStateSize;
};

const SIZE_CLASSES: Record<EmptyStateSize, string> = {
  section:
    "animate-rise flex flex-col items-center gap-5 rounded-xl border border-border-soft px-6 py-14 text-center",
  inline: "animate-rise flex flex-col items-start gap-3 py-6 text-left",
};

const TITLE_CLASSES: Record<EmptyStateSize, string> = {
  section: "text-lg font-semibold text-ink",
  inline: "text-sm font-semibold text-ink",
};

const DESCRIPTION_CLASSES: Record<EmptyStateSize, string> = {
  section: "mx-auto max-w-[42ch] text-pretty text-sm text-ink-muted",
  inline: "max-w-[42ch] text-pretty text-sm text-ink-muted",
};

/**
 * Says plainly that a screen — or a result within it — has nothing to show,
 * and why, instead of padding it with invented content or reusing an error
 * treatment for a plain absence of data (ADR-0014, docs/states.md).
 */
export function EmptyState({
  title,
  description,
  action,
  size = "section",
}: EmptyStateProps) {
  return (
    <div className={cn(SIZE_CLASSES[size])}>
      {size === "section" ? <Moulding className="w-24" /> : null}
      <div className="space-y-2">
        <h2 className={TITLE_CLASSES[size]}>{title}</h2>
        {description ? (
          <p className={DESCRIPTION_CLASSES[size]}>{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
