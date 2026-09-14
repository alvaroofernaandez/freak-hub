import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
  });

  it("announces itself as a closed menu button", () => {
    render(<UserMenu {...PROPS} />);

    const trigger = screen.getByRole("button", { name: /álvaro fernández/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  /*
   * Between 768 and 1023 px the header row does not have room for the handle:
   * with it, the wordmark wrapped and the trigger was clipped (issue #63).
   * The avatar alone carries the identity there, exactly as the tablet
   * artboard draws it.
   */
  it("drops the handle in the band where the header row has no room for it", () => {
    render(<UserMenu {...PROPS} />);

    expect(screen.getByText("@alvaro")).toHaveClass("hidden", "lg:inline");
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

  /*
   * The mobile bottom bar traded "Grupo" for "Recomendaciones", so below
   * 768 px this menu is the only route to the group (issue #63).
   */
  it("links to the group, the one destination the mobile bottom bar gave up", async () => {
    const user = userEvent.setup();
    render(<UserMenu {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /álvaro fernández/i }));

    const group = screen.getByRole("menuitem", { name: /grupo/i });
    expect(group).toHaveAttribute("href", "/miembros");
    /*
     * Only below 768 px. Above it the navbar already carries "Grupo", and a
     * second entry would repeat what is one click away — the same reason
     * /recomendaciones stays out of this menu (docs/design.md).
     */
    expect(group).toHaveClass("md:hidden");
  });

  /*
   * The trigger is the only session control on a phone, so its name has to be
   * said once. `Avatar` labels its <img> with the display name and this menu
   * adds an sr-only copy of it, so anyone whose picture had actually loaded
   * heard "Álvaro Fernández Álvaro Fernández". Every other test here passes
   * `avatarUrl: null`, which is why it went unnoticed.
   */
  it("says the name once when the picture has loaded, not twice", () => {
    render(<UserMenu {...PROPS} avatarUrl="https://example.test/alvaro.png" />);

    expect(
      screen.queryByRole("img", { name: "Álvaro Fernández" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /álvaro fernández/i }),
    ).toBeInTheDocument();
  });

  it("still names the trigger when there is no picture to hide", () => {
    render(<UserMenu {...PROPS} avatarUrl={null} />);

    expect(
      screen.getByRole("button", { name: /álvaro fernández/i }),
    ).toBeInTheDocument();
  });

  it("links to settings, now that the route exists", async () => {
    const user = userEvent.setup();
    render(<UserMenu {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /álvaro fernández/i }));

    expect(screen.getByRole("menuitem", { name: /ajustes/i })).toHaveAttribute(
      "href",
      "/ajustes",
    );
  });

  it("switches the theme without leaving the page you are on", async () => {
    const user = userEvent.setup();
    render(<UserMenu {...PROPS} />);

    await user.click(screen.getByRole("button", { name: /álvaro fernández/i }));
    const themeItem = screen.getByRole("menuitemcheckbox", {
      name: /tema claro/i,
    });
    expect(themeItem).toHaveAttribute("aria-checked", "false");

    await user.click(themeItem);

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    // Still open: flipping the theme is not a reason to lose the menu.
    expect(screen.getByRole("menu")).toBeInTheDocument();
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

  it("keeps the menu mounted through its exit animation, instead of removing it the instant it closes", () => {
    render(
      <div>
        <UserMenu {...PROPS} />
        <button type="button">Fuera</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: /álvaro fernández/i });
    // Radix opens the dropdown trigger on pointerdown, not on click.
    fireEvent.pointerDown(trigger, { button: 0, pointerId: 1 });
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // Radix's outside-dismiss detection listens for `pointerdown`, not
    // `click`.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Fuera" }), {
      button: 0,
      pointerId: 1,
    });

    // Synchronous check, no `await`: the popover exits through Motion, it
    // does not vanish the instant it closes.
    expect(screen.getByRole("menu")).toBeInTheDocument();
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
