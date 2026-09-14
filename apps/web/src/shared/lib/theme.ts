/**
 * The two themes, and the one piece of state that has to exist before React
 * does (docs/design.md#paleta).
 *
 * Dark is the default, so the tokens in `globals.css` are the dark ones and
 * the light theme is an override behind `[data-theme="light"]` on <html>.
 * That attribute is what has to be right on the very first paint: set it
 * during hydration and someone who chose light gets a dark flash on every
 * navigation to the app. Hence `THEME_INIT_SCRIPT`, which runs inline before
 * anything is painted.
 */
export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

export const THEME_STORAGE_KEY = "freak-hub-theme";

/** `--ground` of each theme, mirrored into `<meta name="theme-color">` so the
 * browser's own chrome stops contradicting the page on mobile. */
export const THEME_COLOR: Record<Theme, string> = {
  dark: "oklch(0.130 0.020 272)",
  light: "oklch(0.975 0.006 272)",
};

export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : DEFAULT_THEME;
}

/**
 * Runs inline in the document, before hydration. Built from the constants
 * above rather than written out by hand, so the key and the colours cannot
 * drift from the ones the rest of the app uses.
 *
 * Reading `localStorage` can throw outright (a browser with site data
 * blocked), and this runs before any error boundary exists, so the whole read
 * sits inside a `try` and the default is already in hand when it fails.
 */
export const THEME_INIT_SCRIPT = [
  "(function(){",
  'var r=document.documentElement,t="dark";',
  `try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="light")t="light"}catch(e){}`,
  "r.dataset.theme=t;",
  "var m=document.querySelector('meta[name=\"theme-color\"]');",
  `if(m)m.setAttribute("content",t==="light"?${JSON.stringify(THEME_COLOR.light)}:${JSON.stringify(THEME_COLOR.dark)});`,
  "})()",
].join("");
