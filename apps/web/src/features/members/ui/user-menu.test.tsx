import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn();
vi.mock("@clerk/nextjs", () => ({ useClerk: () => ({ signOut }) }));

const { UserMenu } = await import("./user-menu");

const PROPS = {
  displayName: "Álvaro Fernández",
  username: "alvaro",
  avatarUrl: null,
};

describe("UserMenu", () => {
  beforeEach(() => {
    signOut.mockReset();
  });

  it("announces itself as a closed menu button", () => {
    render(<UserMenu {...PROPS} />);

    const trigger = screen.getByRole("button", { name: /álvaro fernández/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens a menu and marks the trigger as expanded", async () => {
    const user = userEvent.setup();
    render(<UserMenu {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /álvaro fernández/i }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /álvaro fernández/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("links to your own profile and to inviting somebody", async () => {
    const user = userEvent.setup();
    render(<UserMenu {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /álvaro fernández/i }));

    expect(
      screen.getByRole("menuitem", { name: /mi perfil/i }),
    ).toHaveAttribute("href", "/miembros/alvaro");
    expect(screen.getByRole("menuitem", { name: /invitar/i })).toHaveAttribute(
      "href",
      "/invitar",
    );
  });

  it("signs out through Clerk without ever showing Clerk", async () => {
    const user = userEvent.setup();
    render(<UserMenu {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /álvaro fernández/i }));
    await user.click(screen.getByRole("menuitem", { name: /cerrar sesión/i }));

    expect(signOut).toHaveBeenCalled();
  });

  it("closes on Escape and hands focus back to the trigger", async () => {
    const user = userEvent.setup();
    render(<UserMenu {...PROPS} />);

    const trigger = screen.getByRole("button", { name: /álvaro fernández/i });
    await user.click(trigger);
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it("closes when the pointer goes elsewhere", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <UserMenu {...PROPS} />
        <button type="button">Fuera</button>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: /álvaro fernández/i }));
    await user.click(screen.getByRole("button", { name: "Fuera" }));

    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("moves into the menu with the down arrow, for keyboard users", async () => {
    const user = userEvent.setup();
    render(<UserMenu {...PROPS} />);

    screen.getByRole("button", { name: /álvaro fernández/i }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menu")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: /mi perfil/i }),
      ).toHaveFocus(),
    );
  });
});
