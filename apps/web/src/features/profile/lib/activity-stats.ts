import type { LibraryItem } from "@/features/library/lib/library-item";
import type { WorkCategory } from "@/shared/api/types";
import { CATEGORY_ORDER } from "@/shared/ui/category-stripe";

export type CategoryActivityStat = {
  category: WorkCategory;
  completed: number;
  inProgress: number;
};

/** Completed/in-progress counts per category, derived from a member's library. */
export function activityStatsByCategory(
  items: LibraryItem[],
): CategoryActivityStat[] {
  return CATEGORY_ORDER.map((category) => {
    const inCategory = items.filter((item) => item.category === category);

    return {
      category,
      completed: inCategory.filter((item) => item.status === "completed")
        .length,
      inProgress: inCategory.filter((item) => item.status === "in_progress")
        .length,
    };
  });
}
