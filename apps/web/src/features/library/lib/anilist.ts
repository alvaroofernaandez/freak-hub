/**
 * TEMPORARY client for AniList's public GraphQL catalog (issue #44, epic #20).
 *
 * The Go API owns domain data (AGENTS.md, rule 2), but it has no catalog
 * integration yet (`docs/roadmap.md`, point 3), so the Add flow would have
 * nothing real to search. AniList is an external read-only catalog, not our
 * database: reading it from the web is allowed, and explicitly framed as
 * disposable. The day `/v1/works` exists, this file is deleted whole — which
 * is why nothing outside it knows AniList exists.
 *
 * Server side only, on purpose. `ANILIST_API_URL` carries no `NEXT_PUBLIC_`
 * prefix, so it is undefined in the browser and a client-side import fails
 * fast into `unavailable`. Three reasons: `docs/catalogs.md` rule 5 keeps
 * catalog calls out of the browser so the other five providers (which do
 * need secrets) never have to move; AniList's ~90 req/min budget is spent
 * per client IP, and the server pays it once instead of every visitor
 * paying it separately behind a shared NAT; and no browser CORS preflight
 * stands between a search and its results.
 *
 * Nothing here is persisted. Caching or proxying this belongs to the
 * backend's own integration (epic #10), not to a module built to be thrown
 * away.
 */

import { z } from "zod";

/**
 * A search hit as the product understands it, with no trace of the provider
 * in its shape. `id` is namespaced (`anilist:1535`) so it can never be
 * mistaken for a `Work` id from our own API.
 */
export type CatalogSearchResult = {
  id: string;
  title: string;
  /** Release year, when the catalog knows it. */
  year?: number;
  coverUrl?: string;
  /** Plain text: the catalog's markup is stripped here, not in a component. */
  synopsis?: string;
};

/**
 * Every way a search can end, as data. There is no fifth branch and no throw:
 * the three failures the epic names (nothing found, the network, the rate
 * limit) are states the screen renders, not exceptions it has to remember to
 * catch (`docs/states.md`).
 *
 * `unavailable` absorbs everything else that is not the caller's problem —
 * a rejected fetch, a timeout, a 5xx, a body that does not parse, a missing
 * endpoint — because the screen's answer to all of them is the same: offer
 * the manual entry instead (`docs/catalogs.md`, rule 3).
 */
export type CatalogSearchOutcome =
  | { status: "ok"; results: CatalogSearchResult[] }
  | { status: "empty" }
  | { status: "rate_limited"; retryAfterSeconds?: number }
  | { status: "unavailable" };

/** Same ceiling as the API client (ADR-0014): no search hangs forever. */
const TIMEOUT_MS = 10_000;

const DEFAULT_LIMIT = 10;

const SEARCH_QUERY = `
  query ($search: String!, $perPage: Int!) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { english romaji native }
        startDate { year }
        seasonYear
        coverImage { large }
        description
      }
    }
  }
`;

const MediaSchema = z.object({
  id: z.number(),
  title: z.object({
    english: z.string().nullish(),
    romaji: z.string().nullish(),
    native: z.string().nullish(),
  }),
  startDate: z.object({ year: z.number().nullish() }).nullish(),
  seasonYear: z.number().nullish(),
  coverImage: z.object({ large: z.string().nullish() }).nullish(),
  description: z.string().nullish(),
});

/** A GraphQL error response carries `errors` and no `data`, so it fails to
 * parse here and lands in `unavailable` without a branch of its own. */
const ResponseSchema = z.object({
  data: z.object({
    Page: z.object({ media: z.array(MediaSchema).nullish() }),
  }),
});

type Media = z.infer<typeof MediaSchema>;

/**
 * AniList returns the synopsis with markup in it (`<br>`, `<i>`, entities).
 * Stripping it at the boundary keeps the provider's formatting from reaching
 * a component, which would otherwise need `dangerouslySetInnerHTML` to show
 * it.
 */
function plainText(markup: string): string | undefined {
  const text = markup
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

  return text === "" ? undefined : text;
}

/** English first because the interface is in Spanish and the English title is
 * the one people here recognise; romaji and native are the fallbacks. An
 * entry with none of the three is unshowable and gets dropped. */
function titleOf(media: Media): string | undefined {
  return (
    media.title.english ?? media.title.romaji ?? media.title.native ?? undefined
  );
}

function adapt(media: Media): CatalogSearchResult | undefined {
  const title = titleOf(media);
  if (!title) {
    return undefined;
  }

  return {
    id: `anilist:${media.id}`,
    title,
    year: media.startDate?.year ?? media.seasonYear ?? undefined,
    coverUrl: media.coverImage?.large ?? undefined,
    synopsis: media.description ? plainText(media.description) : undefined,
  };
}

function rateLimited(response: Response): CatalogSearchOutcome {
  const seconds = Number(response.headers.get("retry-after"));

  return Number.isFinite(seconds) && seconds > 0
    ? { status: "rate_limited", retryAfterSeconds: seconds }
    : { status: "rate_limited" };
}

export interface SearchAnimeOptions {
  /** Cancels the search when the caller navigates away mid-request. */
  signal?: AbortSignal;
  limit?: number;
}

/**
 * Searches anime in the external catalog. Never throws and never rejects:
 * every failure comes back as one of the `CatalogSearchOutcome` branches.
 */
export async function searchAnime(
  query: string,
  { signal, limit = DEFAULT_LIMIT }: SearchAnimeOptions = {},
): Promise<CatalogSearchOutcome> {
  const search = query.trim();
  if (search === "") {
    return { status: "empty" };
  }

  const endpoint = process.env.ANILIST_API_URL;
  if (!endpoint) {
    return { status: "unavailable" };
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: { search, perPage: limit },
      }),
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { status: "unavailable" };
  }

  if (response.status === 429) {
    return rateLimited(response);
  }

  if (!response.ok) {
    return { status: "unavailable" };
  }

  const parsed = ResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success) {
    return { status: "unavailable" };
  }

  const results = (parsed.data.data.Page.media ?? [])
    .map(adapt)
    .filter((result): result is CatalogSearchResult => result !== undefined);

  return results.length === 0 ? { status: "empty" } : { status: "ok", results };
}
