import { describe, expect, it } from "vitest";
import type { LibraryItem } from "@/features/library/lib/library-item";
import { CATEGORY_ORDER } from "@/shared/ui/category-stripe";
import { activityStatsByCategory } from "./activity-stats";

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: "entry-1",
    workId: "work-1",
    title: "Una obra",
    category: "anime",
    status: "completed",
    progress: 0,
    progressTotal: null,
    rating: null,
    isFavourite: false,
    owned: false,
    note: null,
    year: null,
    season: null,
    source: "anilist",
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const ITEMS: LibraryItem[] = [
  item({ id: "1", title: "Anime terminado", status: "completed" }),
  item({ id: "2", title: "Anime en curso", status: "in_progress" }),
  item({ id: "3", title: "Otro anime en curso", status: "in_progress" }),
  item({
    id: "4",
    title: "Manga wishlist",
    category: "manga",
    status: "wishlist",
  }),
];

describe("activityStatsByCategory", () => {
  it("returns one entry per category, in canonical order", () => {
    const stats = activityStatsByCategory(ITEMS);

    expect(stats.map((stat) => stat.category)).toEqual(CATEGORY_ORDER);
  });

  it("counts completed and in-progress entries for each category", () => {
    const stats = activityStatsByCategory(ITEMS);

    const anime = stats.find((stat) => stat.category === "anime");
    expect(anime).toEqual({ category: "anime", completed: 1, inProgress: 2 });

    const manga = stats.find((stat) => stat.category === "manga");
    expect(manga).toEqual({ category: "manga", completed: 0, inProgress: 0 });
  });

  it("returns zero counts for every category when the library is empty", () => {
    const stats = activityStatsByCategory([]);

    for (const stat of stats) {
      expect(stat.completed).toBe(0);
      expect(stat.inProgress).toBe(0);
    }
  });
});
