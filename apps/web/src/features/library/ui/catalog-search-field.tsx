"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { SEARCH_MAX_LENGTH } from "@/features/library/lib/catalog-search";
import { cn } from "@/shared/lib/cn";
import { CoverPlaceholder } from "./cover-placeholder";

/**
 * Long enough that a normal typist sends one request per word instead of one
 * per letter, short enough that the wait is not felt. The external catalog
 * spends its rate limit per IP and the server pays it for everyone
 * (docs/catalogs.md), so the debounce is a budget, not only a nicety.
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Three rows, with the title bar a different width in each: identical rows
 * read as a repeating pattern rather than as a list of different things
 * arriving. The widths double as React keys, so no array index is needed.
 */
const SKELETON_TITLE_WIDTHS = ["w-1/3", "w-1/2", "w-2/5"];

type CatalogSearchFieldProps = {
  /** The term the page was rendered for: the `q` of the current URL. */
  query: string;
  /** What the live region should say once this render settles. */
  announcement: string;
  /** The results, empty state or error the server rendered for `query`. */
  children: ReactNode;
};

function hrefFor(pathname: string, term: string): string {
  return term === ""
    ? pathname
    : `${pathname}?${new URLSearchParams({ q: term })}`;
}

/**
 * The search field of the Add flow, and the only client-side piece of it.
 *
 * The results themselves are rendered on the server from the `q` of the URL,
 * not fetched from here: the catalog module is server-only (`ANILIST_API_URL`
 * carries no `NEXT_PUBLIC_` prefix, so in the browser it would silently
 * degrade to «no disponible»), and keeping the call there also keeps the
 * provider out of the browser entirely — no CORS preflight, one shared rate
 * limit instead of one per visitor.
 *
 * That is also what keeps an in-flight search from painting over a newer one.
 * There is no response to arrive late here: what is on screen is a pure
 * function of the URL, and the URL only ever holds the latest term. A stale
 * render cannot win a race it is not in. The debounce timer is cleared on
 * every keystroke, so a superseded search is never even sent.
 *
 * `router.replace`, not `push`: a search box that files a history entry per
 * word turns the back button into an undo for typing.
 */
export function CatalogSearchField({
  query,
  announcement,
  children,
}: CatalogSearchFieldProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(query);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = value.trim();

    // The page already shows this term: either nothing was typed, or the
    // search we asked for has just come back. Either way there is nothing in
    // flight.
    if (term === query) {
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearching(true);
      router.replace(hrefFor(pathname, term), { scroll: false });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value, query, router, pathname]);

  return (
    <div className="space-y-6">
      <input
        type="search"
        aria-label="Buscar en el catálogo externo"
        maxLength={SEARCH_MAX_LENGTH}
        placeholder="Buscar…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full max-w-md rounded-lg border border-accent bg-surface px-4 py-2.5 text-ink placeholder:text-ink-muted"
      />

      {/* One region, mounted from the first render and never unmounted: only
       * its text changes. A live region that enters the DOM already holding
       * its message is missed by the browser's watcher, which only observes
       * nodes that were already there (`shared/ui/pending-label.tsx`,
       * docs/states.md) — so the wait has to be spoken *here*, not by a node
       * that appears alongside the skeleton. Emptying it during the search
       * instead would announce nothing at all on the way out and leave the
       * previous count as the last thing said. */}
      <output
        data-testid="catalog-search-announcement"
        aria-live="polite"
        className="sr-only"
      >
        {searching ? "Buscando…" : announcement}
      </output>

      {searching ? <SearchingRows /> : children}
    </div>
  );
}

/**
 * Rows in the shape of the results that are coming, rather than a spinner in
 * the middle of the content: the list does not jump when they arrive.
 *
 * Entirely decorative, and silent by design: the wait is announced by the
 * field's own persistent live region. A second `<output>` here would both go
 * unheard (it enters the DOM with its text already set) and collide with the
 * first one under a plain `getByRole("status")`.
 */
function SearchingRows() {
  return (
    <div aria-hidden="true" className="border-t border-border-soft">
      {SKELETON_TITLE_WIDTHS.map((width) => (
        <div
          key={width}
          className="flex items-start gap-4 border-b border-border-soft py-3.5 opacity-60"
        >
          <CoverPlaceholder className="h-[78px] w-[58px] rounded-md" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className={cn("h-3.5 rounded bg-surface-raised", width)} />
            <div className="h-2.5 w-12 rounded bg-surface-raised" />
            <div className="h-2.5 w-2/3 rounded bg-surface-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}
