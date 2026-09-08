export type MockMember = {
  username: string;
  displayName: string;
  /** ISO 8601 timestamp of when the member joined the group. */
  memberSince: string;
};

/**
 * Fake group members standing in for the future members endpoint
 * (docs/roadmap.md). Delete once /miembros reads them for real.
 */
export const MOCK_MEMBERS: MockMember[] = [
  {
    username: "edward",
    displayName: "Edward Elric",
    memberSince: "2022-03-15T00:00:00.000Z",
  },
  {
    username: "alphonse",
    displayName: "Alphonse Elric",
    memberSince: "2022-04-02T00:00:00.000Z",
  },
  {
    username: "gon",
    displayName: "Gon Freecss",
    memberSince: "2023-09-10T00:00:00.000Z",
  },
  {
    username: "killua",
    displayName: "Killua Zoldyck",
    memberSince: "2023-11-20T00:00:00.000Z",
  },
];

export function findMember(username: string): MockMember | undefined {
  return MOCK_MEMBERS.find((member) => member.username === username);
}
