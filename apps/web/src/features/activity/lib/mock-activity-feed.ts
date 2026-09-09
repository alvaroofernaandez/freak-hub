export type MockActivityEvent = {
  id: string;
  actorUsername: string;
  text: string;
  timestamp: string;
};

/**
 * Fake data standing in for the future activity feed endpoint
 * (docs/roadmap.md, docs/domain.md#feed-de-actividad). Full group feed, in
 * descending chronological order — not the three-line teaser on /inicio.
 * Delete once /actividad reads it for real.
 */
export const MOCK_ACTIVITY_FEED: MockActivityEvent[] = [
  {
    id: "activity-1",
    actorUsername: "gon",
    text: "valoró Elden Ring con un 10",
    timestamp: "2026-09-05T09:40:00.000Z",
  },
  {
    id: "activity-2",
    actorUsername: "killua",
    text: "marcó Wingspan como favorito",
    timestamp: "2026-09-04T21:15:00.000Z",
  },
  {
    id: "activity-3",
    actorUsername: "edward",
    text: "terminó Fullmetal Alchemist: Brotherhood",
    timestamp: "2026-09-04T18:05:00.000Z",
  },
  {
    id: "activity-4",
    actorUsername: "alphonse",
    text: "aceptó la recomendación de Frieren: Beyond Journey's End",
    timestamp: "2026-09-03T20:30:00.000Z",
  },
  {
    id: "activity-5",
    actorUsername: "gon",
    text: "empezó Hunter x Hunter (2011)",
    timestamp: "2026-09-03T12:10:00.000Z",
  },
  {
    id: "activity-6",
    actorUsername: "killua",
    text: "terminó Terraforming Mars",
    timestamp: "2026-09-02T22:50:00.000Z",
  },
  {
    id: "activity-7",
    actorUsername: "alphonse",
    text: "se unió al grupo",
    timestamp: "2026-09-02T10:00:00.000Z",
  },
  {
    id: "activity-8",
    actorUsername: "edward",
    text: "marcó Fullmetal Alchemist: Brotherhood como favorito",
    timestamp: "2026-09-01T19:25:00.000Z",
  },
  {
    id: "activity-9",
    actorUsername: "gon",
    text: "valoró Disco Elysium con un 9",
    timestamp: "2026-08-31T23:05:00.000Z",
  },
  {
    id: "activity-10",
    actorUsername: "killua",
    text: "aceptó la recomendación de Brass: Birmingham",
    timestamp: "2026-08-31T14:40:00.000Z",
  },
  {
    id: "activity-11",
    actorUsername: "edward",
    text: "empezó Vinland Saga",
    timestamp: "2026-08-30T17:55:00.000Z",
  },
  {
    id: "activity-12",
    actorUsername: "alphonse",
    text: "valoró Wingspan con un 8",
    timestamp: "2026-08-29T11:20:00.000Z",
  },
];
