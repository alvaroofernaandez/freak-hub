import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemberRow } from "./member-row";

describe("MemberRow", () => {
  it("links to the member's profile", () => {
    render(<MemberRow username="gon" displayName="Gon Freecss" />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/miembros/gon",
    );
  });

  it("shows the display name and the handle", () => {
    render(<MemberRow username="gon" displayName="Gon Freecss" />);

    expect(screen.getByText("Gon Freecss")).toBeInTheDocument();
    expect(screen.getByText("@gon")).toBeInTheDocument();
  });

  it("shows the avatar image when given one", () => {
    render(
      <MemberRow
        username="gon"
        displayName="Gon Freecss"
        avatarUrl="https://example.com/gon.png"
      />,
    );

    expect(
      screen.getByRole("img", { name: "Gon Freecss" }),
    ).toHaveAttribute("src", "https://example.com/gon.png");
  });
});
