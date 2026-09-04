import type { CategoryId } from "@/shared/ui/category-stripe";
import type { EntryStatus } from "@/shared/ui/status-badge";

export type MockWork = {
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
  /** Boardgame only: id of the base MockWork this one expands (ADR-0006). */
  expansionOf?: string;
  /** TCG only: personal decks built inside this game (ADR-0007). */
  decks?: string[];
};

/**
 * Fake data standing in for `GET /v1/library` until that endpoint exists
 * (see docs/roadmap.md). Delete this file and every import of it once the
 * real library feature lands.
 */
export const MOCK_WORKS: MockWork[] = [
  // --- Anime ---
  {
    id: "anime-fma",
    title: "Fullmetal Alchemist: Brotherhood",
    category: "anime",
    status: "completed",
    progress: 64,
    rating: 10,
    isFavourite: true,
    owned: false,
  },
  {
    id: "anime-hxh",
    title: "Hunter x Hunter (2011)",
    category: "anime",
    status: "in_progress",
    progress: 78,
    isFavourite: true,
    owned: false,
  },
  {
    id: "anime-frieren",
    title: "Frieren: Beyond Journey's End",
    category: "anime",
    status: "wishlist",
    isFavourite: false,
    owned: false,
  },
  {
    id: "anime-mob",
    title: "Mob Psycho 100",
    category: "anime",
    status: "on_hold",
    progress: 20,
    isFavourite: false,
    owned: false,
  },

  // --- Manga ---
  {
    id: "manga-vinland",
    title: "Vinland Saga",
    category: "manga",
    status: "in_progress",
    progress: 45,
    isFavourite: false,
    owned: true,
  },
  {
    id: "manga-berserk",
    title: "Berserk",
    category: "manga",
    status: "dropped",
    progress: 30,
    rating: 8,
    isFavourite: false,
    owned: true,
  },
  {
    id: "manga-chainsaw",
    title: "Chainsaw Man",
    category: "manga",
    status: "completed",
    progress: 97,
    rating: 9,
    isFavourite: true,
    owned: false,
  },

  // --- Videojuegos ---
  {
    id: "game-eldenring",
    title: "Elden Ring",
    category: "game",
    status: "completed",
    progress: 100,
    rating: 10,
    isFavourite: true,
    owned: true,
  },
  {
    id: "game-hades",
    title: "Hades",
    category: "game",
    status: "in_progress",
    progress: 55,
    isFavourite: false,
    owned: true,
  },
  {
    id: "game-outerwilds",
    title: "Outer Wilds",
    category: "game",
    status: "wishlist",
    isFavourite: false,
    owned: false,
  },
  {
    id: "game-celeste",
    title: "Celeste",
    category: "game",
    status: "completed",
    progress: 100,
    rating: 9,
    isFavourite: false,
    owned: true,
  },

  // --- Películas ---
  {
    id: "film-spiderverse",
    title: "Spider-Man: Across the Spider-Verse",
    category: "film",
    status: "completed",
    rating: 10,
    isFavourite: true,
    owned: false,
  },
  {
    id: "film-perfectdays",
    title: "Perfect Days",
    category: "film",
    status: "pending",
    isFavourite: false,
    owned: false,
  },
  {
    id: "film-dune2",
    title: "Dune: Parte Dos",
    category: "film",
    status: "wishlist",
    isFavourite: false,
    owned: false,
  },

  // --- Juegos de mesa (con expansión, ADR-0006) ---
  {
    id: "board-wingspan",
    title: "Wingspan",
    category: "boardgame",
    status: "completed",
    rating: 9,
    isFavourite: true,
    owned: true,
  },
  {
    id: "board-wingspan-european",
    title: "Wingspan: European Expansion",
    category: "boardgame",
    status: "completed",
    rating: 8,
    isFavourite: false,
    owned: true,
    expansionOf: "board-wingspan",
  },
  {
    id: "board-catan",
    title: "Catan",
    category: "boardgame",
    status: "in_progress",
    isFavourite: false,
    owned: true,
  },
  {
    id: "board-brass",
    title: "Brass: Birmingham",
    category: "boardgame",
    status: "wishlist",
    isFavourite: false,
    owned: false,
  },

  // --- TCG (con mazos, ADR-0007) ---
  {
    id: "tcg-mtg",
    title: "Magic: The Gathering",
    category: "tcg",
    status: "in_progress",
    isFavourite: true,
    owned: true,
    decks: ["Mono-Rojo Agresivo", "Azul-Negro Control", "Selesnya Tokens"],
  },
  {
    id: "tcg-pokemon",
    title: "Pokémon TCG",
    category: "tcg",
    status: "pending",
    isFavourite: false,
    owned: true,
    decks: ["Charizard ex"],
  },
  {
    id: "tcg-yugioh",
    title: "Yu-Gi-Oh!",
    category: "tcg",
    status: "wishlist",
    isFavourite: false,
    owned: false,
  },
];

export function countByCategory(works: MockWork[]): Record<CategoryId, number> {
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

export function worksByCategory(
  works: MockWork[],
  category: CategoryId,
): MockWork[] {
  return works.filter((work) => work.category === category);
}

export type WorkFilters = {
  status?: EntryStatus;
  favouriteOnly?: boolean;
  ownedOnly?: boolean;
};

export function filterWorks(
  works: MockWork[],
  filters: WorkFilters,
): MockWork[] {
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
    return true;
  });
}
