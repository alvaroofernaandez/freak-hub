import { describe, expect, it } from "vitest";
import {
  countByCategory,
  filterWorks,
  MOCK_WORKS,
  worksByCategory,
} from "./mock-works";

describe("MOCK_WORKS", () => {
  it("has at least three works per category", () => {
    const categories = [
      "anime",
      "manga",
      "game",
      "film",
      "boardgame",
      "tcg",
    ] as const;

    for (const category of categories) {
      const count = MOCK_WORKS.filter(
        (work) => work.category === category,
      ).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it("includes a boardgame expansion linked to a base game via expansionOf", () => {
    const expansion = MOCK_WORKS.find(
      (work) => work.category === "boardgame" && work.expansionOf,
    );

    expect(expansion).toBeDefined();
    expect(MOCK_WORKS.some((work) => work.id === expansion?.expansionOf)).toBe(
      true,
    );
  });

  it("includes a tcg work with two or more decks", () => {
    const withDecks = MOCK_WORKS.find(
      (work) => work.category === "tcg" && (work.decks?.length ?? 0) >= 2,
    );

    expect(withDecks).toBeDefined();
  });
});

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
    const counts = countByCategory(MOCK_WORKS);

    for (const category of Object.keys(counts) as (keyof typeof counts)[]) {
      const expected = MOCK_WORKS.filter(
        (work) => work.category === category,
      ).length;
      expect(counts[category]).toBe(expected);
    }
  });
});

describe("worksByCategory", () => {
  it("returns only works of the given category", () => {
    const result = worksByCategory(MOCK_WORKS, "anime");

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((work) => work.category === "anime")).toBe(true);
  });
});

describe("filterWorks", () => {
  const works = worksByCategory(MOCK_WORKS, "anime");

  it("returns every work when no filter is given", () => {
    expect(filterWorks(works, {})).toEqual(works);
  });

  it("filters by status", () => {
    const result = filterWorks(works, { status: "completed" });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((work) => work.status === "completed")).toBe(true);
  });

  it("filters by favourite", () => {
    const result = filterWorks(works, { favouriteOnly: true });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((work) => work.isFavourite)).toBe(true);
  });

  it("filters by owned", () => {
    const result = filterWorks(MOCK_WORKS, { ownedOnly: true });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((work) => work.owned)).toBe(true);
  });

  it("combines filters", () => {
    const result = filterWorks(MOCK_WORKS, {
      status: "completed",
      favouriteOnly: true,
    });

    expect(
      result.every((work) => work.status === "completed" && work.isFavourite),
    ).toBe(true);
  });
});
