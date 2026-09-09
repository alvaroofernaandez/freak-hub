import type { ReactNode } from "react";
import { Moulding } from "./moulding";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

/**
 * Says plainly that a screen has nothing to show yet, instead of padding it
 * with invented content. Used wherever the backend for a screen does not
 * exist (docs/roadmap.md).
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-xl border border-border-soft px-6 py-14 text-center">
      <Moulding className="w-24" />
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mx-auto max-w-[42ch] text-pretty text-sm text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
