import type { CatalogSearchResult } from "@/features/library/lib/anilist";
import { CoverPlaceholder } from "./cover-placeholder";

type CatalogSearchResultsProps = {
  results: CatalogSearchResult[];
};

/**
 * The hits of an external catalog search, as the mockup draws them
 * (docs/design/high-fidelity-desktop.html §6): a plain list of hairline-
 * separated rows, 58×78 cover on the left, title and year stacked beside it.
 * No cards — a card inside a list of near-identical rows adds a border and a
 * shadow to say what a row separator already says.
 *
 * Two things the mockup has and this does not, both on purpose:
 *
 * - The «Añadir» and wishlist buttons. `/v1/library` exists now and the web
 *   writes to it (issue #73), so the old reason for leaving them out is gone
 *   and the real one has to be stated or somebody will add the button on the
 *   strength of a stale comment: **`POST /v1/works` always creates
 *   `source: manual` with `source_id: null`, and refuses a `source` on
 *   purpose.** An «Añadir» here could therefore only register the anime as a
 *   manual work. It would lie about where the record came from, and it would
 *   create a separate row per person who added the same series — exactly what
 *   the partial unique index `works_source_idx` and the
 *   `works_source_id_matches_source` constraint exist to prevent. Adding from
 *   a catalogue hit needs an import route in the API (`source: anilist` with
 *   its `source_id`), which is a vertical of its own. Until that exists, a
 *   button that looks live and does the wrong thing is worse than no button.
 * - Motion. The list is replaced on every debounced keystroke, so an entrance
 *   animation here would fire hundreds of times a session; the `stagger-in`
 *   cascade used by the library grid is deliberately not applied (ADR-0012).
 *
 * `synopsis` arrives as plain text from `anilist.ts` — the catalog's markup is
 * stripped at that boundary precisely so nothing here needs
 * `dangerouslySetInnerHTML`.
 */
export function CatalogSearchResults({ results }: CatalogSearchResultsProps) {
  return (
    <ul className="border-t border-border-soft">
      {results.map((result) => (
        <li
          key={result.id}
          className="flex items-start gap-4 border-b border-border-soft py-3.5"
        >
          {result.coverUrl ? (
            // biome-ignore lint/performance/noImgElement: next/image would need the catalog CDN declared in next.config.ts, coupling the build config to a provider this module exists to make disposable.
            <img
              data-testid="catalog-result-cover"
              src={result.coverUrl}
              alt=""
              width={58}
              height={78}
              loading="lazy"
              decoding="async"
              className="h-[78px] w-[58px] flex-none rounded-md object-cover"
            />
          ) : (
            <CoverPlaceholder
              testId="catalog-result-cover-placeholder"
              className="h-[78px] w-[58px] rounded-md"
            />
          )}

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[13px] text-ink">{result.title}</p>
            {result.year ? (
              <p className="font-mono text-[11px] tabular-nums text-ink-muted">
                {result.year}
              </p>
            ) : null}
            {result.synopsis ? (
              <p className="line-clamp-2 text-pretty text-xs text-ink-muted">
                {result.synopsis}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
