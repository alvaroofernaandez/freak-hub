import type { CategoryId } from "@/shared/ui/category-stripe";
import type { EntryStatus } from "@/shared/ui/status-badge";

export type Work = {
  id: string;
  title: string;
  category: CategoryId;
  status: EntryStatus;
  /** 0-100, meaning depends on category (episodes/hours/chapters watched, etc). */
  progress?: number;
  /** 1-10. */
  rating?: number;
  isFavourite: boolean;
  owned?: boolean;
  /** Boardgame only: id of the base Work this one expands (ADR-0006). */
  expansionOf?: string;
  /** TCG only: personal decks built inside this game (ADR-0007). */
  decks?: string[];
  /** Release year, shown in the work page header's metadata line. */
  year?: number;
  /** Play time, e.g. "40–70 min", shown in the work page header's metadata line. */
  duration?: string;
  /** Player count, e.g. "1–5 jugadores", shown in the work page header's metadata line. */
  players?: string;
  /** Publisher/studio name, shown in the work page header's metadata line. */
  publisher?: string;
  /** Attribution for where this entry's data comes from (e.g. "BoardGameGeek"). */
  source?: string;
};

export function countByCategory(works: Work[]): Record<CategoryId, number> {
  const counts: Record<CategoryId, number> = {
    anime: 0,
    manga: 0,
    game: 0,
    film: 0,
    boardgame: 0,
    tcg: 0,
  };

  for (const work of works) {
    counts[work.category] += 1;
  }

  return counts;
}

export function worksByCategory(works: Work[], category: CategoryId): Work[] {
  return works.filter((work) => work.category === category);
}

export type WorkFilters = {
  status?: EntryStatus;
  favouriteOnly?: boolean;
  ownedOnly?: boolean;
  search?: string;
};

export function filterWorks(works: Work[], filters: WorkFilters): Work[] {
  const search = filters.search?.trim().toLowerCase();

  return works.filter((work) => {
    if (filters.status && work.status !== filters.status) {
      return false;
    }
    if (filters.favouriteOnly && !work.isFavourite) {
      return false;
    }
    if (filters.ownedOnly && !work.owned) {
      return false;
    }
    if (search && !work.title.toLowerCase().includes(search)) {
      return false;
    }
    return true;
  });
}

/**
 * "recent" keeps the given order (there is no createdAt field yet to sort
 * by, see docs/roadmap.md), "alphabetical" sorts by title and "rating" puts
 * the highest-rated works first, unrated ones last.
 */
export type WorkSort = "recent" | "alphabetical" | "rating";

export function sortWorks(works: Work[], sort: WorkSort): Work[] {
  if (sort === "alphabetical") {
    return [...works].sort((a, b) => a.title.localeCompare(b.title, "es"));
  }
  if (sort === "rating") {
    return [...works].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  }
  return works;
}
