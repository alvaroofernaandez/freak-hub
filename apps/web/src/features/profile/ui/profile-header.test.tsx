import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileHeader } from "./profile-header";

describe("ProfileHeader", () => {
  it("dates the membership in a machine-readable time element", () => {
    render(
      <ProfileHeader
        displayName="Gon Freecss"
        username="gon"
        memberSince="2023-09-10T00:00:00.000Z"
      />,
    );

    expect(screen.getByTestId("profile-member-since")).toHaveAttribute(
      "datetime",
      "2023-09-10T00:00:00.000Z",
    );
  });

  it("renders the actions slot, so a profile can offer editing", () => {
    render(
      <ProfileHeader
        displayName="Gon Freecss"
        username="gon"
        actions={<button type="button">Editar perfil</button>}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Editar perfil" }),
    ).toBeInTheDocument();
  });

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

    // The line is split across a <span> and a <time>, so match on the
    // paragraph's whole text instead of a single text node.
    expect(
      screen.getByTestId("profile-member-since").closest("p"),
    ).toHaveTextContent(/en el grupo desde marzo de 2022/i);
  });

  it("omits the member-since line when it is not given", () => {
    render(<ProfileHeader displayName="Edward Elric" username="edward" />);

    expect(screen.queryByText(/en el grupo desde/)).not.toBeInTheDocument();
  });
});
