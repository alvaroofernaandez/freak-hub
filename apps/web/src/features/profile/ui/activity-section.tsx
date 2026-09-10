"use client";

import { useState } from "react";
import type { CategoryActivityStat } from "@/features/profile/lib/activity-stats";
import { AnimatedNumber } from "@/shared/ui/animated-number";
import { CATEGORY_LABELS, type CategoryId } from "@/shared/ui/category-stripe";
import { EmptyState } from "@/shared/ui/empty-state";
import { Select } from "@/shared/ui/select";

type ActivitySectionProps = {
  stats: CategoryActivityStat[];
};

/** Personal, non-comparative stats per category (ADR-0010): bare div bars, no charting library. */
export function ActivitySection({ stats }: ActivitySectionProps) {
  const [category, setCategory] = useState<CategoryId | "all">("all");

  const hasActivity = stats.some(
    (stat) => stat.completed > 0 || stat.inProgress > 0,
  );

  if (!hasActivity) {
    return (
      <EmptyState
        title="Sin actividad todavía"
        description="Aquí aparecerán tus estadísticas por categoría."
      />
    );
  }

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
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        Categoría
        <Select
          label="Categoría"
          value={category}
          onValueChange={(value) => setCategory(value as CategoryId | "all")}
          options={[
            { value: "all", label: "Todas" },
            ...stats.map((stat) => ({
              value: stat.category,
              label: CATEGORY_LABELS[stat.category],
            })),
          ]}
        />
      </div>

      <div className="space-y-4">
        {visible.map((stat) => (
          <div
            key={stat.category}
            data-testid="activity-row"
            className="space-y-1.5"
          >
            <p className="text-sm">{CATEGORY_LABELS[stat.category]}</p>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${(stat.completed / max) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right font-mono text-xs text-ink-muted">
                <AnimatedNumber value={stat.completed} />
              </span>
              <span className="text-xs text-ink-muted">terminadas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full bg-ink-muted"
                  style={{ width: `${(stat.inProgress / max) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right font-mono text-xs text-ink-muted">
                <AnimatedNumber value={stat.inProgress} />
              </span>
              <span className="text-xs text-ink-muted">en curso</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
