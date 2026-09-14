import { ArrowUpRight } from "reicon-react";

type Catalog = {
  /** The categories this catalog feeds, as the app names them. */
  categories: string;
  name: string;
  href: string;
};

/**
 * Where the works come from (docs/catalogs.md). TMDB requires visible
 * attribution and the rest deserve it, so all five are credited in the same
 * place rather than only the one that asks.
 *
 * A plain static list: the integrations do not exist yet (docs/roadmap.md),
 * and this does not depend on them — the credit is owed to the catalog, not
 * to a particular response.
 */
const CATALOGS: Catalog[] = [
  { categories: "Anime y manga", name: "AniList", href: "https://anilist.co" },
  { categories: "Videojuegos", name: "IGDB", href: "https://igdb.com" },
  { categories: "Películas", name: "TMDB", href: "https://themoviedb.org" },
  {
    categories: "Juegos de mesa",
    name: "BoardGameGeek",
    href: "https://boardgamegeek.com",
  },
  { categories: "TCG", name: "Scryfall", href: "https://scryfall.com" },
];

export function CatalogAttribution() {
  return (
    <ul className="divide-y divide-border-soft rounded-xl border border-border bg-surface">
      {CATALOGS.map(({ categories, name, href }) => (
        <li
          key={name}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5"
        >
          <span className="text-sm text-ink-muted">{categories}</span>
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink transition-colors duration-150 hover:text-accent"
          >
            {name}
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
