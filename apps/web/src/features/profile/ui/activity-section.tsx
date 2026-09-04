"use client";

import { useState } from "react";
import type { CategoryActivityStat } from "@/features/profile/lib/mock-activity";
import { CATEGORY_LABELS, type CategoryId } from "@/shared/ui/category-stripe";

type ActivitySectionProps = {
  stats: CategoryActivityStat[];
};

/** Personal, non-comparative stats per category (ADR-0010) — bare div bars, no charting library. */
export function ActivitySection({ stats }: ActivitySectionProps) {
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const visible =
    category === "all"
      ? stats
      : stats.filter((stat) => stat.category === category);
  const max = Math.max(
    1,
    ...stats.flatMap((stat) => [stat.completed, stat.inProgress]),
  );

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        Categoría
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as CategoryId | "all")
          }
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-ink"
        >
          <option value="all">Todas</option>
          {stats.map((stat) => (
            <option key={stat.category} value={stat.category}>
              {CATEGORY_LABELS[stat.category]}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-4">
        {visible.map((stat) => (
          <div key={stat.category} data-testid="activity-row" className="space-y-1.5">
            <p className="text-sm">{CATEGORY_LABELS[stat.category]}</p>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${(stat.completed / max) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right font-mono text-xs text-ink-muted">
                {stat.completed}
              </span>
              <span className="text-xs text-ink-faint">terminadas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full bg-ink-muted"
                  style={{ width: `${(stat.inProgress / max) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right font-mono text-xs text-ink-muted">
                {stat.inProgress}
              </span>
              <span className="text-xs text-ink-faint">en curso</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
