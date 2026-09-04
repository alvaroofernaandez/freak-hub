import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FriendProfileView } from "./friend-profile-view";

describe("FriendProfileView", () => {
  it("shows the friend's header", () => {
    render(<FriendProfileView displayName="Gon Freecss" username="gon" />);

    expect(
      screen.getByRole("heading", { name: "Gon Freecss" }),
    ).toBeInTheDocument();
    expect(screen.getByText("@gon")).toBeInTheDocument();
  });

  it("shows all four sections", () => {
    render(<FriendProfileView displayName="Gon Freecss" username="gon" />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Biblioteca",
      "Actividad",
      "Top",
      "Recomendaciones",
    ]);
  });

  it("does not show the edit-sections control", () => {
    render(<FriendProfileView displayName="Gon Freecss" username="gon" />);

    expect(
      screen.queryByRole("button", { name: /editar secciones/i }),
    ).not.toBeInTheDocument();
  });
});
