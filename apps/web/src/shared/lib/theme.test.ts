import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THEME,
  parseTheme,
  THEME_COLOR,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "./theme";

function runInitScript(): void {
  // The real thing runs as an inline <script>, before hydration. Evaluating
  // the same string is the closest jsdom gets to that.
  new Function(THEME_INIT_SCRIPT)();
}

describe("parseTheme", () => {
  it("keeps a theme the app actually has", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it.each([
    null,
    undefined,
    "",
    "sepia",
    "Light",
  ])("falls back to the dark default for %o", (value) => {
    expect(parseTheme(value)).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe("dark");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="whatever" />';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks the document dark when nothing was ever chosen", () => {
    runInitScript();

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("marks the document light when light was chosen on a previous visit", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    runInitScript();

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("moves the browser chrome colour with the theme", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    runInitScript();

    expect(
      document.head.querySelector('meta[name="theme-color"]'),
    ).toHaveAttribute("content", THEME_COLOR.light);
  });

  it("still lands on dark when storage is unavailable, instead of throwing before hydration", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(() => runInitScript()).not.toThrow();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("reads the same storage key the app writes", () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });
});

/**
 * The script is worth nothing unless it is actually in the document, ahead of
 * everything React paints. jsdom cannot render the root layout (it renders
 * <html> itself), so this reads the source, the same trick
 * `token-contrast.test.ts` uses.
 */
describe("the root layout", () => {
  const layout = readFileSync(
    join(__dirname, "..", "..", "app", "layout.tsx"),
    "utf8",
  );

  it("inlines the theme script instead of resolving the theme after hydration", () => {
    expect(layout).toContain("THEME_INIT_SCRIPT");
    expect(layout).toContain("dangerouslySetInnerHTML");
  });

  it("puts it ahead of the app, so nothing is painted with the wrong theme first", () => {
    expect(layout.indexOf("THEME_INIT_SCRIPT")).toBeLessThan(
      layout.indexOf("<ClerkProvider"),
    );
  });
});
