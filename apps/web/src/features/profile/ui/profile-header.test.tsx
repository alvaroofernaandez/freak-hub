import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileHeader } from "./profile-header";

describe("ProfileHeader", () => {
  it("shows the display name as a heading", () => {
    render(<ProfileHeader displayName="Edward Elric" username="edward" />);

    expect(
      screen.getByRole("heading", { name: "Edward Elric" }),
    ).toBeInTheDocument();
  });

  it("shows the username handle", () => {
    render(<ProfileHeader displayName="Edward Elric" username="edward" />);

    expect(screen.getByText("@edward")).toBeInTheDocument();
  });

  it("passes the avatar image through to the Avatar", () => {
    render(
      <ProfileHeader
        displayName="Edward Elric"
        username="edward"
        avatarUrl="https://example.com/ed.png"
      />,
    );

    expect(screen.getByRole("img", { name: "Edward Elric" })).toHaveAttribute(
      "src",
      "https://example.com/ed.png",
    );
  });
});
