import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { OwnProfileView } from "./own-profile-view";

const PROPS = { displayName: "Edward Elric", username: "edward" };

describe("OwnProfileView", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the header and all four tabs by default", () => {
    render(<OwnProfileView {...PROPS} />);

    expect(
      screen.getByRole("heading", { name: "Edward Elric" }),
    ).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Biblioteca",
      "Actividad",
      "Top",
      "Recomendaciones",
    ]);
  });

  it("keeps the edit-sections panel closed until asked to open it", async () => {
    const user = userEvent.setup();
    render(<OwnProfileView {...PROPS} />);

    expect(
      screen.queryByText("Secciones visibles"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /editar secciones/i }),
    );

    expect(screen.getByText("Secciones visibles")).toBeInTheDocument();
  });

  it("hides a section immediately when it is unchecked, and persists it across a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<OwnProfileView {...PROPS} />);

    await user.click(
      screen.getByRole("button", { name: /editar secciones/i }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Actividad" }));

    expect(
      screen.queryByRole("tab", { name: "Actividad" }),
    ).not.toBeInTheDocument();

    unmount();
    render(<OwnProfileView {...PROPS} />);

    expect(
      screen.queryByRole("tab", { name: "Actividad" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });
});
