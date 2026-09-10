"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether `query` currently matches, via `matchMedia`. Used to switch
 * `AddCategoryModalHost` between a centered `Dialog` and a bottom `Drawer`
 * (ADR-0013): the breakpoint decision has to happen client-side, since
 * `matchMedia` does not exist on the server.
 *
 * `initial` is returned until the first client effect runs, so server and
 * first-client-render markup match (no hydration mismatch) — the caller
 * mounting this only while its own content is hidden (e.g. a closed modal)
 * means that brief default is never actually visible either way.
 */
export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(initial);

  useEffect(() => {
    // jsdom does not implement `matchMedia` unless a test stubs it, and this
    // hook can mount unconditionally (`AddCategoryModalHost` renders in the
    // app shell regardless of whether it's open) — guard instead of
    // crashing tests that never touch this hook's behaviour.
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener("change", listener);
    return () => mediaQueryList.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
