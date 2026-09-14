import type {
  LibraryEntry,
  LibraryEntryStatus,
  WorkCategory,
  WorkSource,
} from "@/shared/api/types";

/**
 * A library entry as the interface wants to read it.
 *
 * The contract's `LibraryEntry` is snake_case and nested — the whole `Work`
 * travels inside it, which is exactly what spares the list a second round of
 * requests — while every screen here wants one flat record per card. Mapping
 * once, on the server, is the same thing `app/(app)/miembros/page.tsx` does
 * with `Member`: components never learn the wire shape, so a contract rename
 * lands in one file instead of eleven.
 *
 * `id` is the **entry's** id, not the work's: `/obras/[id]` reads
 * `GET /v1/library/{id}`, so that is the identity every card links with.
 * `workId` is kept because the write path will need it, and because the two
 * being different is the kind of thing worth being explicit about.
 *
 * Every nullable contract field stays `T | null` rather than becoming
 * optional. In the contract they are all `required` with a `["T", "null"]`
 * type: "the catalogue does not know the year" is a fact the API states, not
 * a field it forgot to send, and `year?: number` would erase that difference.
 */
export type LibraryItem = {
  /** The `LibraryEntry` id — what `/obras/[id]` is keyed by. */
  id: string;
  workId: string;
  title: string;
  category: WorkCategory;
  status: LibraryEntryStatus;
  /** An absolute count in the category's own unit, never a percentage. */
  progress: number;
  /** What `progress` counts towards, when the catalogue knows it. */
  progressTotal: number | null;
  rating: number | null;
  isFavourite: boolean;
  owned: boolean;
  note: string | null;
  year: number | null;
  season: string | null;
  source: WorkSource;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

/**
 * `WorkMetadata` is an open object on purpose (the five categories that are
 * not anime have not declared their keys yet), so anything read out of it is
 * checked at runtime rather than trusted from the type.
 */
function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function toLibraryItem(entry: LibraryEntry): LibraryItem {
  const { work } = entry;

  return {
    id: entry.id,
    workId: work.id,
    title: work.title,
    category: work.category,
    status: entry.status,
    progress: entry.progress,
    progressTotal: positiveInteger(work.metadata.episodes),
    rating: entry.rating,
    isFavourite: entry.is_favourite,
    owned: entry.owned,
    note: entry.note,
    year: work.year,
    season: nonEmptyString(work.metadata.season),
    source: work.source,
    startedAt: entry.started_at,
    finishedAt: entry.finished_at,
    createdAt: entry.created_at,
  };
}

/**
 * How far along the entry is, as a share of its total — or `null` when there
 * is no total to divide by.
 *
 * `progress` is an absolute count whose unit depends on the category
 * (packages/contracts/openapi.yaml, `LibraryEntry.progress`), so it is never
 * a percentage on its own. Feeding it straight to `ProgressBar`, which takes
 * 0-100, would draw "12 episodes watched" as a bar 12% full: a number the
 * API never said. Without a total, nothing draws a bar.
 */
export function progressPercentage(item: LibraryItem): number | null {
  if (item.progressTotal === null || item.progressTotal <= 0) {
    return null;
  }

  return Math.min(100, Math.round((item.progress / item.progressTotal) * 100));
}

/**
 * The unit each category counts in, taken verbatim from the contract's own
 * description of `LibraryEntry.progress`. `film` and `tcg` are missing
 * because the contract does not name a unit for them: the figure is shown
 * bare rather than guessed at.
 */
const PROGRESS_UNIT: Partial<
  Record<WorkCategory, { one: string; many: string }>
> = {
  anime: { one: "episodio", many: "episodios" },
  manga: { one: "capítulo", many: "capítulos" },
  game: { one: "hora", many: "horas" },
  boardgame: { one: "partida", many: "partidas" },
};

/** How far along the entry is, in words: "12 / 64 episodios", "40 horas". */
export function progressLabel(item: LibraryItem): string | null {
  if (item.progress <= 0) {
    return null;
  }

  const figure =
    item.progressTotal === null
      ? String(item.progress)
      : `${item.progress} / ${item.progressTotal}`;
  const unit = PROGRESS_UNIT[item.category];

  if (!unit) {
    return figure;
  }

  const reference = item.progressTotal ?? item.progress;

  return `${figure} ${reference === 1 ? unit.one : unit.many}`;
}

export function countByCategory(
  items: LibraryItem[],
): Record<WorkCategory, number> {
  const counts: Record<WorkCategory, number> = {
    anime: 0,
    manga: 0,
    game: 0,
    film: 0,
    boardgame: 0,
    tcg: 0,
  };

  for (const item of items) {
    counts[item.category] += 1;
  }

  return counts;
}

export type LibraryFilters = {
  status?: LibraryEntryStatus;
  favouriteOnly?: boolean;
  ownedOnly?: boolean;
  search?: string;
};

export function filterItems(
  items: LibraryItem[],
  filters: LibraryFilters,
): LibraryItem[] {
  const search = filters.search?.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.status && item.status !== filters.status) {
      return false;
    }
    if (filters.favouriteOnly && !item.isFavourite) {
      return false;
    }
    if (filters.ownedOnly && !item.owned) {
      return false;
    }
    if (search && !item.title.toLowerCase().includes(search)) {
      return false;
    }
    return true;
  });
}

/**
 * "recent" is newest first by `created_at`, which is the order the API already
 * serves (ADR-0011) — stated here rather than assumed, so the option keeps
 * meaning something after a client-side filter reshuffles nothing but still
 * leaves the caller free to sort a list it assembled itself. "alphabetical"
 * sorts by title, "rating" puts the highest first and the unrated last.
 */
export type LibrarySort = "recent" | "alphabetical" | "rating";

export function sortItems(
  items: LibraryItem[],
  sort: LibrarySort,
): LibraryItem[] {
  if (sort === "alphabetical") {
    return [...items].sort((a, b) => a.title.localeCompare(b.title, "es"));
  }
  if (sort === "rating") {
    return [...items].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  }
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
