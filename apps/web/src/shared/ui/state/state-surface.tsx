import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type StateSize = "page" | "section" | "inline";
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

interface StateSurfaceProps {
  size: StateSize;
  title: string;
  /** Defaults to 2: a state surface is rarely the page's own `<h1>`. */
  headingLevel?: HeadingLevel;
  description?: string;
  /** Only when the icon actually carries meaning (never decorative). Always
   * rendered `aria-hidden`: the title and description already say what
   * happened in words. */
  icon?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  supportReference?: ReactNode;
  className?: string;
}

const SIZE_CLASSES: Record<StateSize, string> = {
  page: "animate-rise flex flex-col items-center gap-5 rounded-xl border border-border-soft px-6 py-14 text-center",
  section:
    "animate-rise flex flex-col items-center gap-4 rounded-xl border border-border-soft px-6 py-10 text-center",
  inline: "flex flex-col items-start gap-2",
};

const ACTIONS_GAP: Record<StateSize, string> = {
  page: "flex flex-wrap items-center justify-center gap-3",
  section: "flex flex-wrap items-center justify-center gap-3",
  inline: "flex flex-wrap items-center gap-3",
};

/**
 * The single internal base every state component (`ErrorState`,
 * `ResourceUnavailableState`, `SessionExpiredState`, `AccountPendingState`…)
 * builds on, instead of one universal component with decades of conditional
 * props (ADR-0014 §4 explicitly rejects that shape). Hierarchy is fixed:
 * nature (icon, optional) → title → description → one primary action →
 * optional secondary → optional support reference (docs/states.md).
 */
export function StateSurface({
  size,
  title,
  headingLevel = 2,
  description,
  icon,
  primaryAction,
  secondaryAction,
  supportReference,
  className,
}: StateSurfaceProps) {
  const HeadingTag = `h${headingLevel}` as HeadingTag;

  return (
    <div className={cn(SIZE_CLASSES[size], className)}>
      {icon ? (
        <span aria-hidden="true" className="text-ink-muted">
          {icon}
        </span>
      ) : null}
      <div className="space-y-2">
        <HeadingTag
          className={cn(
            "font-semibold text-ink",
            size === "inline" ? "text-sm" : "text-lg",
          )}
        >
          {title}
        </HeadingTag>
        {description ? (
          <p className="mx-auto max-w-[65ch] text-pretty text-sm text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {primaryAction ? (
        <div className={ACTIONS_GAP[size]}>
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
      {supportReference}
    </div>
  );
}
