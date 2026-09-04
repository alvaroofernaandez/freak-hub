export type MockMember = {
  username: string;
  displayName: string;
};

/**
 * Fake group members standing in for the future members endpoint
 * (docs/roadmap.md). Delete once /miembros reads them for real.
 */
export const MOCK_MEMBERS: MockMember[] = [
  { username: "edward", displayName: "Edward Elric" },
  { username: "alphonse", displayName: "Alphonse Elric" },
  { username: "gon", displayName: "Gon Freecss" },
  { username: "killua", displayName: "Killua Zoldyck" },
];

export function findMember(username: string): MockMember | undefined {
  return MOCK_MEMBERS.find((member) => member.username === username);
}
