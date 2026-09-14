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
 * Meant to run on the server, and nothing here enforces it. `ANILIST_API_URL`
 * carries no `NEXT_PUBLIC_` prefix, so Next's `process` polyfill leaves it
 * `undefined` in the browser and a client-side call degrades into
 * `unavailable` — it is not prevented, and no build error says so. Making it
 * a hard error would mean the `server-only` package, a new dependency for a
 * module written to be deleted; the honest sentence was preferred. Three
 * reasons it belongs on the server: `docs/catalogs.md` rule 5 keeps
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
import { combineSignals } from "@/shared/lib/api-client";

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

/** AniList caps `perPage` at 50 and rejects the query above it. */
const MAX_LIMIT = 50;

/**
 * A ceiling for `Retry-After`. AniList's window is a minute, so anything
 * beyond a few minutes is a proxy inventing a number — and a caller that
 * feeds it straight into a timer would leave the search disabled for hours.
 */
const MAX_RETRY_AFTER_SECONDS = 300;

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
 * AniList returns the synopsis with markup in it (`<br>`, `<i>`, entities),
 * and its descriptions are community-edited. Reducing it to plain text at
 * this boundary keeps the provider's formatting from reaching a component,
 * which would otherwise need `dangerouslySetInnerHTML` to show it.
 *
 * The order is the whole point. Decoding entities *after* removing tags
 * manufactures markup that was never there: `&lt;script&gt;…&lt;/script&gt;`
 * arrives as inert text, survives the tag removal untouched, and then the
 * decode turns it into a real `<script>` element — the exact string a future
 * `dangerouslySetInnerHTML` would execute. So: decode the escapes first, let
 * whatever they reveal be removed as the markup it is, and decode `&amp;`
 * last so that `&amp;lt;` ends up as the literal text `&lt;` its author
 * wrote rather than as another round of decoding.
 */
function plainText(markup: string): string | undefined {
  const text = markup
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&(?:apos|#0?39);/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div)>/gi, " ")
    .replace(/<[^>]*>/g, "")
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

/** `Retry-After` may also be an HTTP date, which is not a number and so
 * comes back without a wait — the caller's own fallback is better than a
 * guess. */
function rateLimited(response: Response): CatalogSearchOutcome {
  const seconds = Number(response.headers.get("retry-after"));

  return Number.isFinite(seconds) && seconds > 0
    ? {
        status: "rate_limited",
        retryAfterSeconds: Math.min(
          Math.ceil(seconds),
          MAX_RETRY_AFTER_SECONDS,
        ),
      }
    : { status: "rate_limited" };
}

export interface SearchAnimeOptions {
  /**
   * Cancels the search when the caller navigates away or types again
   * mid-request. It is combined with the deadline, never substituted for it.
   * A search the caller aborted resolves to `unavailable`; the caller asked
   * for it, so it should ignore that outcome rather than render it.
   */
  signal?: AbortSignal;
  /** Clamped to AniList's own 1-50 range. */
  limit?: number;
  /** Overrides `TIMEOUT_MS`, mainly for tests — as in `api-client.ts`. */
  timeoutMs?: number;
}

/**
 * Searches anime in the external catalog. Never throws and never rejects:
 * every failure comes back as one of the `CatalogSearchOutcome` branches.
 */
export async function searchAnime(
  query: string,
  {
    signal,
    limit = DEFAULT_LIMIT,
    timeoutMs = TIMEOUT_MS,
  }: SearchAnimeOptions = {},
): Promise<CatalogSearchOutcome> {
  const search = query.trim();
  if (search === "") {
    return { status: "empty" };
  }

  const endpoint = process.env.ANILIST_API_URL;
  if (!endpoint) {
    // Without this, a missing variable is indistinguishable from AniList
    // being down — for as long as nobody thinks to check, because the
    // outcome contract makes the misconfiguration a perfectly ordinary
    // state. Development only, like `reportError`.
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[freak-hub] ANILIST_API_URL is not set, so catalog search is disabled. Declare it in apps/web/.env.local (see apps/web/.env.example).",
      );
    }
    return { status: "unavailable" };
  }

  const perPage = Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_LIMIT);

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
        variables: { search, perPage },
      }),
      signal: combineSignals(AbortSignal.timeout(timeoutMs), signal),
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
