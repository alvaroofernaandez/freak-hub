"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  parseTheme,
  THEME_COLOR,
  THEME_STORAGE_KEY,
  type Theme,
} from "./theme";

/**
 * The chosen theme, read straight off the document instead of out of React
 * state. `THEME_INIT_SCRIPT` has already put it on <html> before hydration,
 * so the document is the source of truth and there is nothing to seed.
 *
 * `useSyncExternalStore` is what makes that safe: React renders the server
 * snapshot (always the dark default, matching the server's HTML) for the
 * hydration pass and swaps to the client snapshot right after, so a person on
 * the light theme never sees a hydration mismatch — only the control catching
 * up, one frame after the page itself is already correct.
 *
 * No context and no provider: a module-level subscriber set keeps every
 * control on the page in step, and there is only ever one document to read.
 */
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): Theme {
  return parseTheme(document.documentElement.dataset.theme);
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;

  const themeColor = document.head.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute("content", THEME_COLOR[theme]);

  // A browser with site data blocked throws on write as readily as on read.
  // Losing the preference for next time is survivable; throwing out of a
  // click handler is not.
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignored on purpose: the theme still applies for this visit.
  }

  for (const listener of listeners) listener();
}

export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => applyTheme(next), []);
  const toggleTheme = useCallback(
    () => applyTheme(getSnapshot() === "light" ? "dark" : "light"),
    [],
  );

  return { theme, setTheme, toggleTheme };
}
