"use client";

import { useState } from "react";
import type { Work } from "@/features/library/lib/work";
import { WorkCard } from "@/features/library/ui/work-card";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategoryId,
} from "@/shared/ui/category-stripe";
import { EmptyState } from "@/shared/ui/empty-state";
import { Select } from "@/shared/ui/select";

type TopSectionProps = {
  works: Work[];
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
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        Categoría
        <Select
          label="Categoría"
          value={category}
          onValueChange={(value) => setCategory(value as CategoryId | "all")}
          options={[
            { value: "all", label: "Todas" },
            ...categoriesWithRatedWorks.map((id) => ({
              value: id,
              label: CATEGORY_LABELS[id],
            })),
          ]}
        />
      </div>

      {top.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {top.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin obras valoradas todavía"
          description="Aquí aparecerán tus obras mejor valoradas."
        />
      )}
    </div>
  );
}
