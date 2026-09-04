import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MOCK_MEMBERS } from "@/features/members/lib/mock-members";

const currentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ currentUser: () => currentUser() }));

const { default: MembersPage } = await import("./page");

describe("MembersPage", () => {
  it("lists you and every mock member, each linking to their profile", async () => {
    currentUser.mockResolvedValue({
      username: "francisco",
      fullName: "Francisco Bermejo",
      imageUrl: "https://example.com/me.png",
    });

    const page = await MembersPage();
    render(page);

    expect(
      screen.getByRole("link", { name: /francisco bermejo/i }),
    ).toHaveAttribute("href", "/miembros/francisco");

    for (const member of MOCK_MEMBERS) {
      expect(
        screen.getByRole("link", { name: new RegExp(member.displayName, "i") }),
      ).toHaveAttribute("href", `/miembros/${member.username}`);
    }
  });

  it("still lists the mock members when there is no current user", async () => {
    currentUser.mockResolvedValue(null);

    const page = await MembersPage();
    render(page);

    for (const member of MOCK_MEMBERS) {
      expect(screen.getByText(member.displayName)).toBeInTheDocument();
    }
  });
});
