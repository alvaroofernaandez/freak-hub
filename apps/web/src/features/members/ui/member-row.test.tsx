import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemberRow } from "./member-row";

describe("MemberRow", () => {
  it("marks your own row so you can find yourself in the roster", () => {
    render(<MemberRow username="gon" displayName="Gon Freecss" isYou />);

    expect(screen.getByText("Tú")).toBeInTheDocument();
  });

  it("marks nobody else's row", () => {
    render(<MemberRow username="gon" displayName="Gon Freecss" />);

    expect(screen.queryByText("Tú")).not.toBeInTheDocument();
  });

  it("answers the pointer: the row lights its border on hover and focus", () => {
    render(<MemberRow username="gon" displayName="Gon Freecss" />);

    const row = screen.getByRole("link", { name: /gon freecss/i });
    expect(row).toHaveClass("hover:border-accent");
    expect(row).toHaveClass("focus-visible:border-accent");
  });

  it("links the whole row to the member's profile", () => {
    render(<MemberRow username="gon" displayName="Gon Freecss" />);

    expect(screen.getByRole("link", { name: /gon freecss/i })).toHaveAttribute(
      "href",
      "/miembros/gon",
    );
  });

  it("says since when they have been in the group, in the mono face used for dates", () => {
    render(
      <MemberRow
        username="gon"
        displayName="Gon Freecss"
        memberSince="2023-09-10T00:00:00.000Z"
      />,
    );

    const since = screen.getByText(/septiembre de 2023/i);
    expect(since).toBeInTheDocument();
    expect(since).toHaveClass("font-mono");
  });

  it("omits the joined line when the date is unknown", () => {
    render(<MemberRow username="gon" displayName="Gon Freecss" />);

    expect(screen.queryByText(/miembro desde/i)).not.toBeInTheDocument();
  });
});
