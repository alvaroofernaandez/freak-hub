import { describe, expect, it } from "vitest";
import {
  countByCategory,
  filterWorks,
  sortWorks,
  type Work,
  worksByCategory,
} from "./work";

const WORKS: Work[] = [
  {
    id: "anime-1",
    title: "Terminada y favorita",
    category: "anime",
    status: "completed",
    isFavourite: true,
    owned: true,
    rating: 9,
  },
  {
    id: "anime-2",
    title: "En curso, no favorita",
    category: "anime",
    status: "in_progress",
    isFavourite: false,
    owned: false,
  },
  {
    id: "manga-1",
    title: "Manga wishlist",
    category: "manga",
    status: "wishlist",
    isFavourite: false,
    owned: false,
  },
];

describe("countByCategory", () => {
  it("counts every category, including categories with zero works", () => {
    const counts = countByCategory([]);

    expect(counts).toEqual({
      anime: 0,
      manga: 0,
      game: 0,
      film: 0,
      boardgame: 0,
      tcg: 0,
    });
  });

  it("counts each work under its own category", () => {
    const counts = countByCategory(WORKS);

    expect(counts.anime).toBe(2);
    expect(counts.manga).toBe(1);
    expect(counts.game).toBe(0);
  });
});

describe("worksByCategory", () => {
  it("returns only works of the given category", () => {
    const result = worksByCategory(WORKS, "anime");

    expect(result).toHaveLength(2);
    expect(result.every((work) => work.category === "anime")).toBe(true);
  });

  it("returns an empty array when there are no works in that category", () => {
    expect(worksByCategory([], "anime")).toEqual([]);
  });
});

describe("filterWorks", () => {
  it("returns every work when no filter is given", () => {
    expect(filterWorks(WORKS, {})).toEqual(WORKS);
  });

  it("filters by status", () => {
    const result = filterWorks(WORKS, { status: "completed" });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("anime-1");
  });

  it("filters by favourite", () => {
    const result = filterWorks(WORKS, { favouriteOnly: true });

    expect(result.every((work) => work.isFavourite)).toBe(true);
  });

  it("filters by owned", () => {
    const result = filterWorks(WORKS, { ownedOnly: true });

    expect(result.every((work) => work.owned)).toBe(true);
  });

  it("filters by a case-insensitive title search", () => {
    const result = filterWorks(WORKS, { search: "WISHLIST" });

    expect(result).toEqual([WORKS[2]]);
  });

  it("combines filters", () => {
    const result = filterWorks(WORKS, {
      status: "completed",
      favouriteOnly: true,
    });

    expect(
      result.every((work) => work.status === "completed" && work.isFavourite),
    ).toBe(true);
  });
});

describe("sortWorks", () => {
  it("keeps the given order for 'recent'", () => {
    expect(sortWorks(WORKS, "recent")).toEqual(WORKS);
  });

  it("sorts alphabetically by title", () => {
    const titles = sortWorks(WORKS, "alphabetical").map((work) => work.title);
    expect(titles).toEqual([
      "En curso, no favorita",
      "Manga wishlist",
      "Terminada y favorita",
    ]);
  });

  it("sorts by rating, highest first, unrated last", () => {
    const titles = sortWorks(WORKS, "rating").map((work) => work.title);
    expect(titles[0]).toBe("Terminada y favorita");
  });
});
