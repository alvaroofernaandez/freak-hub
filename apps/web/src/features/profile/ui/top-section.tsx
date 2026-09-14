"use client";

import { useState } from "react";
import type { LibraryItem } from "@/features/library/lib/library-item";
import { WorkCard } from "@/features/library/ui/work-card";
import type { WorkCategory } from "@/shared/api/types";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/shared/ui/category-stripe";
import { EmptyState } from "@/shared/ui/empty-state";
import { Select } from "@/shared/ui/select";

type TopSectionProps = {
  items: LibraryItem[];
};

/** The profile's best-rated works, filterable by category (docs/screens.md, ADR-0010). */
export function TopSection({ items }: TopSectionProps) {
  const [category, setCategory] = useState<WorkCategory | "all">("all");

  const categoriesWithRatedWorks = CATEGORY_ORDER.filter((id) =>
    items.some(
      (item) => item.category === id && typeof item.rating === "number",
    ),
  );

  const top = items
    .filter((item) => typeof item.rating === "number")
    .filter((item) => category === "all" || item.category === category)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        Categoría
        <Select
          label="Categoría"
          value={category}
          onValueChange={(value) => setCategory(value as WorkCategory | "all")}
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
          {top.map((item) => (
            <WorkCard key={item.id} item={item} />
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
