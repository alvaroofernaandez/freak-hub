import { describe, expect, it } from "vitest";
import type { MockWork } from "@/features/library/lib/mock-works";
import { CATEGORY_ORDER } from "@/shared/ui/category-stripe";
import { activityStatsByCategory } from "./mock-activity";

const WORKS: MockWork[] = [
  {
    id: "1",
    title: "Anime terminado",
    category: "anime",
    status: "completed",
    isFavourite: false,
  },
  {
    id: "2",
    title: "Anime en curso",
    category: "anime",
    status: "in_progress",
    isFavourite: false,
  },
  {
    id: "3",
    title: "Otro anime en curso",
    category: "anime",
    status: "in_progress",
    isFavourite: false,
  },
  {
    id: "4",
    title: "Manga wishlist",
    category: "manga",
    status: "wishlist",
    isFavourite: false,
  },
];

describe("activityStatsByCategory", () => {
  it("returns one entry per category, in canonical order", () => {
    const stats = activityStatsByCategory(WORKS);

    expect(stats.map((stat) => stat.category)).toEqual(CATEGORY_ORDER);
  });

  it("counts completed and in-progress works for each category", () => {
    const stats = activityStatsByCategory(WORKS);

    const anime = stats.find((stat) => stat.category === "anime");
    expect(anime).toEqual({ category: "anime", completed: 1, inProgress: 2 });

    const manga = stats.find((stat) => stat.category === "manga");
    expect(manga).toEqual({ category: "manga", completed: 0, inProgress: 0 });
  });

  it("returns zero counts for every category when there are no works", () => {
    const stats = activityStatsByCategory([]);

    for (const stat of stats) {
      expect(stat.completed).toBe(0);
      expect(stat.inProgress).toBe(0);
    }
  });
});
