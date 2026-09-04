export type MockRecommendation = {
  id: string;
  workTitle: string;
  fromUsername: string;
  reason: string;
};

export type MockActivityEntry = {
  id: string;
  text: string;
};

/**
 * Fake data standing in for the future recommendations and activity feed
 * endpoints (docs/roadmap.md). Delete once /inicio reads them for real.
 */
export const MOCK_PENDING_RECOMMENDATIONS: MockRecommendation[] = [
  {
    id: "rec-1",
    workTitle: "Frieren: Beyond Journey's End",
    fromUsername: "edward",
    reason: "Por el ritmo pausado y la banda sonora, te va a encantar.",
  },
  {
    id: "rec-2",
    workTitle: "Terraforming Mars",
    fromUsername: "killua",
    reason: "Encaja con lo que te gusta de Brass: economía apretada.",
  },
  {
    id: "rec-3",
    workTitle: "Disco Elysium",
    fromUsername: "gon",
    reason: "La escritura es lo mejor que he leído en un videojuego.",
  },
];

export const MOCK_RECENT_ACTIVITY: MockActivityEntry[] = [
  { id: "act-1", text: "@edward terminó Fullmetal Alchemist: Brotherhood" },
  { id: "act-2", text: "@killua marcó Wingspan como favorito" },
  { id: "act-3", text: "@gon valoró Elden Ring con un 10" },
  { id: "act-4", text: "@edward se unió al grupo" },
];
