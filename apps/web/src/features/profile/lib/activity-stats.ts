import type { Work } from "@/features/library/lib/work";
import { CATEGORY_ORDER, type CategoryId } from "@/shared/ui/category-stripe";

export type CategoryActivityStat = {
  category: CategoryId;
  completed: number;
  inProgress: number;
};

/** Completed/in-progress counts per category, derived from a member's library. */
export function activityStatsByCategory(works: Work[]): CategoryActivityStat[] {
  return CATEGORY_ORDER.map((category) => {
    const categoryWorks = works.filter((work) => work.category === category);

    return {
      category,
      completed: categoryWorks.filter((work) => work.status === "completed")
        .length,
      inProgress: categoryWorks.filter((work) => work.status === "in_progress")
        .length,
    };
  });
}
