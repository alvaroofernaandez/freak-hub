import type { MockWork } from "@/features/library/lib/mock-works";
import { CATEGORY_ORDER, type CategoryId } from "@/shared/ui/category-stripe";

export type CategoryActivityStat = {
  category: CategoryId;
  completed: number;
  inProgress: number;
};

/**
 * Completed/in-progress counts per category, derived from the same mock
 * library (docs/roadmap.md) used everywhere else — there is no per-member
 * library modelled yet, so every profile shows the same shared demo data.
 */
export function activityStatsByCategory(
  works: MockWork[],
): CategoryActivityStat[] {
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
