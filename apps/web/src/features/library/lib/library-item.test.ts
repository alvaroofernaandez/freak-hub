import { describe, expect, it } from "vitest";
import type { LibraryEntry, Work } from "@/shared/api/types";
import {
  countByCategory,
  filterItems,
  type LibraryItem,
  progressLabel,
  progressPercentage,
  sortItems,
  toLibraryItem,
} from "./library-item";

function work(overrides: Partial<Work> = {}): Work {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Fullmetal Alchemist: Brotherhood",
    category: "anime",
    source: "anilist",
    source_id: "5114",
    cover_url: null,
    synopsis: null,
    year: 2009,
    metadata: {},
    expansion_of: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    work: work(),
    status: "in_progress",
    progress: 12,
    rating: null,
    is_favourite: false,
    owned: false,
    note: null,
    started_at: null,
    finished_at: null,
    created_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return { ...toLibraryItem(entry()), ...overrides };
}

describe("toLibraryItem", () => {
  it("keeps the entry id as the identity, since that is what the work page is keyed by", () => {
    const mapped = toLibraryItem(entry());

    expect(mapped.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(mapped.workId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("flattens the embedded work rather than making the UI walk entry.work", () => {
    const mapped = toLibraryItem(entry());

    expect(mapped.title).toBe("Fullmetal Alchemist: Brotherhood");
    expect(mapped.category).toBe("anime");
    expect(mapped.year).toBe(2009);
    expect(mapped.source).toBe("anilist");
  });

  it("carries the entry's own fields under names the interface already speaks", () => {
    const mapped = toLibraryItem(
      entry({ is_favourite: true, owned: true, rating: 9, note: "Brutal" }),
    );

    expect(mapped.isFavourite).toBe(true);
    expect(mapped.owned).toBe(true);
    expect(mapped.rating).toBe(9);
    expect(mapped.note).toBe("Brutal");
  });

  it("models a nullable contract field as null, never as absent", () => {
    const mapped = toLibraryItem(
      entry({ rating: null, work: work({ year: null }) }),
    );

    expect(mapped.rating).toBeNull();
    expect(mapped.year).toBeNull();
    expect("rating" in mapped).toBe(true);
    expect("year" in mapped).toBe(true);
  });

  it("reads the anime total out of the work's open metadata object", () => {
    const mapped = toLibraryItem(
      entry({
        work: work({ metadata: { episodes: 64, season: "2009-spring" } }),
      }),
    );

    expect(mapped.progressTotal).toBe(64);
    expect(mapped.season).toBe("2009-spring");
  });

  it("ignores an episode count on a category the contract never gives one to", () => {
    const mapped = toLibraryItem(
      entry({
        work: work({ category: "film", metadata: { episodes: 12 } }),
      }),
    );

    expect(mapped.progressTotal).toBeNull();
  });

  it("leaves the total null when the catalogue does not know it", () => {
    const mapped = toLibraryItem(entry({ work: work({ metadata: {} }) }));

    expect(mapped.progressTotal).toBeNull();
    expect(mapped.season).toBeNull();
  });

  it("ignores a metadata total that is not a usable number", () => {
    const mapped = toLibraryItem(
      entry({ work: work({ metadata: { episodes: 0 } }) }),
    );

    expect(mapped.progressTotal).toBeNull();
  });

  it("keeps the entry's creation instant, which is what 'recent' orders by", () => {
    const mapped = toLibraryItem(entry());

    expect(mapped.createdAt).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("progressPercentage", () => {
  it("is null when no total is known, so nothing draws a bar it cannot justify", () => {
    expect(
      progressPercentage(item({ progress: 12, progressTotal: null })),
    ).toBeNull();
  });

  it("is the share of the total when the total is known", () => {
    expect(progressPercentage(item({ progress: 12, progressTotal: 24 }))).toBe(
      50,
    );
  });

  it("never exceeds 100, even when the stored progress overshoots the total", () => {
    expect(progressPercentage(item({ progress: 90, progressTotal: 64 }))).toBe(
      100,
    );
  });
});

describe("progressLabel", () => {
  it("names the unit the contract documents for the category", () => {
    expect(progressLabel(item({ progress: 12, progressTotal: null }))).toBe(
      "12 episodios",
    );
    expect(
      progressLabel(
        item({ category: "game", progress: 40, progressTotal: null }),
      ),
    ).toBe("40 horas");
  });

  it("says the total too when the catalogue knows it", () => {
    expect(progressLabel(item({ progress: 12, progressTotal: 64 }))).toBe(
      "12 / 64 episodios",
    );
  });

  it("agrees with the number in the singular", () => {
    expect(progressLabel(item({ progress: 1, progressTotal: null }))).toBe(
      "1 episodio",
    );
  });

  it("shows the bare figure for a category whose unit the contract does not document", () => {
    expect(
      progressLabel(
        item({ category: "film", progress: 3, progressTotal: null }),
      ),
    ).toBe("3");
  });

  it("is null at zero, because 'not started' is not progress worth printing", () => {
    expect(
      progressLabel(item({ progress: 0, progressTotal: null })),
    ).toBeNull();
  });
});

describe("countByCategory", () => {
  it("counts every category, including the ones with nothing in them", () => {
    expect(countByCategory([])).toEqual({
      anime: 0,
      manga: 0,
      game: 0,
      film: 0,
      boardgame: 0,
      tcg: 0,
    });
  });

  it("counts each entry under its work's category", () => {
    const counts = countByCategory([
      item({ id: "a", category: "anime" }),
      item({ id: "b", category: "anime" }),
      item({ id: "c", category: "manga" }),
    ]);

    expect(counts.anime).toBe(2);
    expect(counts.manga).toBe(1);
    expect(counts.game).toBe(0);
  });
});

describe("filterItems", () => {
  const items = [
    item({
      id: "a",
      title: "Terminada y favorita",
      status: "completed",
      isFavourite: true,
      owned: true,
      rating: 9,
    }),
    item({ id: "b", title: "En curso", status: "in_progress" }),
    item({ id: "c", title: "Manga en la wishlist", status: "wishlist" }),
  ];

  it("returns everything when nothing is filtered", () => {
    expect(filterItems(items, {})).toEqual(items);
  });

  it("filters by status", () => {
    expect(
      filterItems(items, { status: "completed" }).map((i) => i.id),
    ).toEqual(["a"]);
  });

  it("filters by favourite", () => {
    expect(
      filterItems(items, { favouriteOnly: true }).every((i) => i.isFavourite),
    ).toBe(true);
  });

  it("filters by owned", () => {
    expect(filterItems(items, { ownedOnly: true }).every((i) => i.owned)).toBe(
      true,
    );
  });

  it("searches the title without minding case", () => {
    expect(filterItems(items, { search: "WISHLIST" }).map((i) => i.id)).toEqual(
      ["c"],
    );
  });

  it("combines filters", () => {
    expect(
      filterItems(items, { status: "completed", favouriteOnly: true }).map(
        (i) => i.id,
      ),
    ).toEqual(["a"]);
  });
});

describe("sortItems", () => {
  const older = item({
    id: "older",
    title: "Zeta",
    rating: 4,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  const newer = item({
    id: "newer",
    title: "Alfa",
    rating: null,
    createdAt: "2026-03-01T00:00:00.000Z",
  });
  const middle = item({
    id: "middle",
    title: "Media",
    rating: 10,
    createdAt: "2026-02-01T00:00:00.000Z",
  });

  it("puts the newest entry first for 'recent', now that created_at exists", () => {
    expect(
      sortItems([older, middle, newer], "recent").map((i) => i.id),
    ).toEqual(["newer", "middle", "older"]);
  });

  it("sorts alphabetically by title", () => {
    expect(
      sortItems([older, middle, newer], "alphabetical").map((i) => i.title),
    ).toEqual(["Alfa", "Media", "Zeta"]);
  });

  it("sorts by rating, highest first, unrated last", () => {
    expect(
      sortItems([older, middle, newer], "rating").map((i) => i.id),
    ).toEqual(["middle", "older", "newer"]);
  });

  it("never mutates the array it was given", () => {
    const original = [older, middle, newer];
    sortItems(original, "alphabetical");

    expect(original.map((i) => i.id)).toEqual(["older", "middle", "newer"]);
  });
});
