import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/profile/actions/update-profile", () => ({
  updateProfile: vi.fn(async () => ({ status: "idle", message: "" })),
}));

import { OwnProfileView } from "./own-profile-view";

const PROPS = { displayName: "Edward Elric", username: "edward" };

describe("OwnProfileView", () => {
  it("offers editing your own profile, not just its sections", () => {
    render(<OwnProfileView {...PROPS} />);

    expect(
      screen.getByRole("button", { name: /editar perfil/i }),
    ).toBeInTheDocument();
  });

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

  it("shows a gear icon on the edit-sections button", () => {
    render(<OwnProfileView {...PROPS} />);

    const button = screen.getByRole("button", { name: /editar secciones/i });
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("shows the member-since line when memberSince is given", () => {
    render(
      <OwnProfileView {...PROPS} memberSince="2022-03-15T00:00:00.000Z" />,
    );

    // Split across a <span> and a <time> since the header was reworked.
    expect(
      screen.getByTestId("profile-member-since").closest("p"),
    ).toHaveTextContent(/en el grupo desde marzo de 2022/i);
  });

  it("keeps the edit-sections panel closed until asked to open it", async () => {
    const user = userEvent.setup();
    render(<OwnProfileView {...PROPS} />);

    expect(screen.queryByText("Orden y visibilidad")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /editar secciones/i }));

    expect(screen.getByText("Orden y visibilidad")).toBeInTheDocument();
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
