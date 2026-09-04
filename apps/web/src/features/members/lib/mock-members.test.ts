import { describe, expect, it } from "vitest";
import { findMember, MOCK_MEMBERS } from "./mock-members";

describe("MOCK_MEMBERS", () => {
  it("has at least three members, each with a username and a display name", () => {
    expect(MOCK_MEMBERS.length).toBeGreaterThanOrEqual(3);
    for (const member of MOCK_MEMBERS) {
      expect(member.username).toMatch(/\S/);
      expect(member.displayName).toMatch(/\S/);
    }
  });

  it("has unique usernames", () => {
    const usernames = MOCK_MEMBERS.map((member) => member.username);
    expect(new Set(usernames).size).toBe(usernames.length);
  });
});

describe("findMember", () => {
  it("returns the member with the given username", () => {
    const [first] = MOCK_MEMBERS;
    expect(findMember(first.username)).toEqual(first);
  });

  it("returns undefined for a username that does not exist", () => {
    expect(findMember("no-existe")).toBeUndefined();
  });
});
