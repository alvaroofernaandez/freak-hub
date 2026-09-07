import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MOCK_ACTIVITY_FEED } from "@/features/activity/lib/mock-activity-feed";
import { findMember } from "@/features/members/lib/mock-members";

const { default: ActivityPage } = await import("./page");

describe("ActivityPage", () => {
  it("renders the text and author link for every event in the mock feed", async () => {
    const page = await ActivityPage();
    render(page);

    for (const event of MOCK_ACTIVITY_FEED) {
      expect(screen.getByText(event.text)).toBeInTheDocument();

      const member = findMember(event.actorUsername);
      if (member) {
        expect(
          screen.getAllByRole("link", { name: member.displayName }).length,
        ).toBeGreaterThan(0);
      }
    }
  });
});
