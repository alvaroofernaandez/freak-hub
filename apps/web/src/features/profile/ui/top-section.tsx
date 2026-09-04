"use client";

import { useState } from "react";
import type { MockWork } from "@/features/library/lib/mock-works";
import { WorkCard } from "@/features/library/ui/work-card";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategoryId,
} from "@/shared/ui/category-stripe";

type TopSectionProps = {
  works: MockWork[];
};

/** The profile's best-rated works, filterable by category (docs/screens.md, ADR-0010). */
export function TopSection({ works }: TopSectionProps) {
  const [category, setCategory] = useState<CategoryId | "all">("all");

  const categoriesWithRatedWorks = CATEGORY_ORDER.filter((id) =>
    works.some(
      (work) => work.category === id && typeof work.rating === "number",
    ),
  );

  const top = works
    .filter((work) => typeof work.rating === "number")
    .filter((work) => category === "all" || work.category === category)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

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
          {categoriesWithRatedWorks.map((id) => (
            <option key={id} value={id}>
              {CATEGORY_LABELS[id]}
            </option>
          ))}
        </select>
      </label>

      {top.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {top.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Sin obras valoradas todavía.</p>
      )}
    </div>
  );
}
