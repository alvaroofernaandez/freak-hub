import type { CategoryId } from "@/shared/ui/category-stripe";

export type MockSearchResult = {
  id: string;
  title: string;
  year: number;
};

/**
 * Fake results standing in for a real external-catalog search (AniList,
 * IGDB, TMDB, BGG, Scryfall — see docs/catalogs.md), which does not exist
 * yet (see docs/roadmap.md). Delete once /anadir/[categoria] searches for
 * real.
 */
const RESULTS: Record<CategoryId, MockSearchResult[]> = {
  anime: [
    { id: "search-anime-1", title: "Jujutsu Kaisen", year: 2020 },
    { id: "search-anime-2", title: "Steins;Gate", year: 2011 },
    { id: "search-anime-3", title: "Made in Abyss", year: 2017 },
  ],
  manga: [
    { id: "search-manga-1", title: "One Piece", year: 1997 },
    { id: "search-manga-2", title: "20th Century Boys", year: 1999 },
  ],
  game: [
    { id: "search-game-1", title: "Baldur's Gate 3", year: 2023 },
    { id: "search-game-2", title: "Hollow Knight", year: 2017 },
    { id: "search-game-3", title: "Disco Elysium", year: 2019 },
  ],
  film: [
    { id: "search-film-1", title: "Parásitos", year: 2019 },
    { id: "search-film-2", title: "El viaje de Chihiro", year: 2001 },
  ],
  boardgame: [
    { id: "search-board-1", title: "Terraforming Mars", year: 2016 },
    { id: "search-board-2", title: "Gloomhaven", year: 2017 },
    { id: "search-board-3", title: "Azul", year: 2017 },
  ],
  tcg: [
    { id: "search-tcg-1", title: "Flesh and Blood", year: 2019 },
    { id: "search-tcg-2", title: "One Piece Card Game", year: 2022 },
  ],
};

export function mockSearchResults(category: CategoryId): MockSearchResult[] {
  return RESULTS[category];
}
