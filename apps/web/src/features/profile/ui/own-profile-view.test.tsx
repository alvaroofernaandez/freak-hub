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

  it("shows the gear icon on the edit-sections button", () => {
    render(<OwnProfileView {...PROPS} />);

    expect(
      screen.getByRole("button", { name: /editar secciones/i }),
    ).toHaveTextContent("⚙");
  });

  it("shows the member-since line when memberSince is given", () => {
    render(
      <OwnProfileView {...PROPS} memberSince="2022-03-15T00:00:00.000Z" />,
    );

    expect(
      screen.getByText(/en el grupo desde marzo de 2022/),
    ).toBeInTheDocument();
  });

  it("keeps the edit-sections panel closed until asked to open it", async () => {
    const user = userEvent.setup();
    render(<OwnProfileView {...PROPS} />);

    expect(screen.queryByText("Secciones visibles")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /editar secciones/i }));

    expect(screen.getByText("Secciones visibles")).toBeInTheDocument();
  });

  it("opens edit-sections as a 560px modal dialog", async () => {
    const user = userEvent.setup();
    render(<OwnProfileView {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /editar secciones/i }));

    const dialog = screen.getByRole("dialog", {
      name: "Editar secciones de tu perfil",
    });
    expect(dialog).toHaveClass("max-w-[560px]");
  });

  it("closes the edit-sections modal with the visible close button", async () => {
    const user = userEvent.setup();
    render(<OwnProfileView {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /editar secciones/i }));
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the edit-sections modal on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<OwnProfileView {...PROPS} />);
    const trigger = screen.getByRole("button", { name: /editar secciones/i });
    await user.click(trigger);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("hides a section immediately when it is unchecked, and persists it across a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<OwnProfileView {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /editar secciones/i }));
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
