import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  UserProfile: () => <div data-testid="clerk-user-profile" />,
}));

const { default: SettingsPage } = await import("./page");

describe("SettingsPage", () => {
  it("names the screen and says what it covers", () => {
    render(<SettingsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Ajustes" }),
    ).toBeInTheDocument();
  });

  it.each([
    "Cuenta",
    "Tema",
    "Tus datos",
    "De dónde salen las fichas",
  ])("carries the '%s' block docs/screens.md asks for", (title) => {
    render(<SettingsPage />);

    expect(
      screen.getByRole("heading", { level: 2, name: title }),
    ).toBeInTheDocument();
  });

  it("hands account management to Clerk instead of rebuilding it", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("clerk-user-profile")).toBeInTheDocument();
  });

  it("puts the theme switch on the screen that owns it", () => {
    render(<SettingsPage />);

    expect(
      screen.getByRole("switch", { name: /tema claro/i }),
    ).toBeInTheDocument();
  });

  it("keeps exporting and deleting visible but switched off", () => {
    render(<SettingsPage />);

    expect(
      screen.getByRole("button", { name: /exportar mis datos/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /borrar mis datos/i }),
    ).toBeDisabled();
  });

  it("credits the five external catalogs", () => {
    render(<SettingsPage />);

    for (const name of [
      "AniList",
      "IGDB",
      "TMDB",
      "BoardGameGeek",
      "Scryfall",
    ]) {
      expect(
        screen.getByRole("link", { name: new RegExp(name, "i") }),
      ).toBeInTheDocument();
    }
  });

  it("separates its blocks with the moulding, like every other screen with sections", () => {
    render(<SettingsPage />);

    expect(screen.getAllByTestId("moulding").length).toBeGreaterThan(0);
  });
});
