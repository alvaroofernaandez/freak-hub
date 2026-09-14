import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchAnime } from "./anilist";

const API_URL = "https://graphql.anilist.example";

function media(overrides: Record<string, unknown> = {}) {
  return {
    id: 1535,
    title: { english: "Death Note", romaji: "Desu Nōto", native: "デスノート" },
    startDate: { year: 2006 },
    seasonYear: 2006,
    coverImage: { large: "https://img.example/death-note.jpg" },
    description: "Un cuaderno <i>mortal</i>.<br>Light lo encuentra.",
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function pageResponse(entries: unknown[]): Response {
  return jsonResponse({ data: { Page: { media: entries } } });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("ANILIST_API_URL", API_URL);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("searchAnime — results", () => {
  it("adapts a match into the local catalog shape", async () => {
    fetchMock.mockResolvedValue(pageResponse([media()]));

    const outcome = await searchAnime("death note");

    expect(outcome).toEqual({
      status: "ok",
      results: [
        {
          id: "anilist:1535",
          title: "Death Note",
          year: 2006,
          coverUrl: "https://img.example/death-note.jpg",
          synopsis: "Un cuaderno mortal. Light lo encuentra.",
        },
      ],
    });
  });

  it("asks AniList for anime only, over POST, at the configured endpoint", async () => {
    fetchMock.mockResolvedValue(pageResponse([media()]));

    await searchAnime("death note");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(API_URL);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/json",
    );
    const body = JSON.parse(init.body as string);
    expect(body.query).toContain("ANIME");
    expect(body.variables).toMatchObject({ search: "death note" });
  });

  it("falls back to the romaji and then the native title", async () => {
    fetchMock.mockResolvedValue(
      pageResponse([
        media({ id: 1, title: { english: null, romaji: "Sousou no Frieren" } }),
        media({ id: 2, title: { english: null, romaji: null, native: "鋼" } }),
      ]),
    );

    const outcome = await searchAnime("frieren");

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.results.map((result) => result.title)).toEqual([
      "Sousou no Frieren",
      "鋼",
    ]);
  });

  it("leaves the optional fields out when AniList has no value for them", async () => {
    fetchMock.mockResolvedValue(
      pageResponse([
        media({
          startDate: { year: null },
          seasonYear: null,
          coverImage: { large: null },
          description: null,
        }),
      ]),
    );

    const outcome = await searchAnime("algo");

    expect(outcome).toEqual({
      status: "ok",
      results: [{ id: "anilist:1535", title: "Death Note" }],
    });
  });

  it("drops an entry with no usable title instead of showing it blank", async () => {
    fetchMock.mockResolvedValue(
      pageResponse([
        media({ id: 7, title: { english: null, romaji: null, native: null } }),
      ]),
    );

    await expect(searchAnime("algo")).resolves.toEqual({ status: "empty" });
  });
});

describe("searchAnime — no results", () => {
  it("reports the empty state when AniList matches nothing", async () => {
    fetchMock.mockResolvedValue(pageResponse([]));

    await expect(searchAnime("zzzzzz")).resolves.toEqual({ status: "empty" });
  });

  it("does not reach the network for a blank query", async () => {
    await expect(searchAnime("   ")).resolves.toEqual({ status: "empty" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("searchAnime — network failure", () => {
  it("reports the unavailable state instead of throwing when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(searchAnime("death note")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("reports the unavailable state when AniList answers 5xx", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 503 }));

    await expect(searchAnime("death note")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("reports the unavailable state when the body is not the expected shape", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ errors: [{ message: "Internal Error" }] }),
    );

    await expect(searchAnime("death note")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("reports the unavailable state when the endpoint is not configured", async () => {
    vi.stubEnv("ANILIST_API_URL", "");

    await expect(searchAnime("death note")).resolves.toEqual({
      status: "unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("searchAnime — rate limit", () => {
  it("reports the rate limit with the seconds AniList asks us to wait", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({}, { status: 429, headers: { "retry-after": "42" } }),
    );

    await expect(searchAnime("death note")).resolves.toEqual({
      status: "rate_limited",
      retryAfterSeconds: 42,
    });
  });

  it("reports the rate limit without seconds when the header is missing", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 429 }));

    await expect(searchAnime("death note")).resolves.toEqual({
      status: "rate_limited",
    });
  });

  it("ignores a Retry-After header that is not a number", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({}, { status: 429, headers: { "retry-after": "soon" } }),
    );

    await expect(searchAnime("death note")).resolves.toEqual({
      status: "rate_limited",
    });
  });
});
