import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "@/shared/lib/theme";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="whatever" />';
  });

  it("is a switch, not a checkbox, and starts off because dark is the default", () => {
    render(<ThemeToggle />);

    const toggle = screen.getByRole("switch", { name: /tema claro/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("turns the light theme on and writes the choice down", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("switch", { name: /tema claro/i }));

    expect(screen.getByRole("switch", { name: /tema claro/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("goes back to dark on a second press", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("switch", { name: /tema claro/i }));
    await user.click(screen.getByRole("switch", { name: /tema claro/i }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("reflects a choice made on a previous visit without being touched", () => {
    document.documentElement.dataset.theme = "light";

    render(<ThemeToggle />);

    expect(screen.getByRole("switch", { name: /tema claro/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("says what it does out loud, so the state is never colour alone", () => {
    render(<ThemeToggle />);

    expect(screen.getByText(/oscuro/i)).toBeInTheDocument();
  });
});
