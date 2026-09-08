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

  it("shows the member-since line, in Spanish, when memberSince is given", () => {
    render(
      <ProfileHeader
        displayName="Edward Elric"
        username="edward"
        memberSince="2022-03-15T00:00:00.000Z"
      />,
    );

    expect(
      screen.getByText(/en el grupo desde marzo de 2022/),
    ).toBeInTheDocument();
  });

  it("omits the member-since line when it is not given", () => {
    render(<ProfileHeader displayName="Edward Elric" username="edward" />);

    expect(screen.queryByText(/en el grupo desde/)).not.toBeInTheDocument();
  });
});
