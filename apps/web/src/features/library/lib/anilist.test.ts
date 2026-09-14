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

  it("drops an entry with no usable title but keeps the rest", async () => {
    fetchMock.mockResolvedValue(
      pageResponse([
        media({ id: 7, title: { english: null, romaji: null, native: null } }),
        media({ id: 8, title: { english: "Monster" } }),
      ]),
    );

    const outcome = await searchAnime("algo");

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]).toMatchObject({
      id: "anilist:8",
      title: "Monster",
    });
  });

  it("reports the empty state when every entry was unusable", async () => {
    fetchMock.mockResolvedValue(
      pageResponse([
        media({ id: 7, title: { english: null, romaji: null, native: null } }),
      ]),
    );

    await expect(searchAnime("algo")).resolves.toEqual({ status: "empty" });
  });
});

describe("searchAnime — synopsis", () => {
  async function synopsisOf(description: string): Promise<string | undefined> {
    fetchMock.mockResolvedValue(pageResponse([media({ description })]));
    const outcome = await searchAnime("algo");
    if (outcome.status !== "ok") {
      throw new Error(`expected results, got ${outcome.status}`);
    }
    return outcome.results[0].synopsis;
  }

  it("never turns escaped markup into real markup", async () => {
    const synopsis = await synopsisOf(
      "Una nota: &lt;b&gt;negrita&lt;/b&gt; y &lt;script&gt;alert(1)&lt;/script&gt;",
    );

    expect(synopsis).toBe("Una nota: negrita y alert(1)");
    expect(synopsis).not.toContain("<");
  });

  it("strips an escaped image tag that carries an event handler", async () => {
    const synopsis = await synopsisOf(
      "Antes &lt;img src=x onerror=alert(1)&gt; despues",
    );

    expect(synopsis).toBe("Antes despues");
  });

  it("decodes an escaped ampersand last, so its payload stays literal text", async () => {
    await expect(synopsisOf("5 &amp;lt; 6")).resolves.toBe("5 &lt; 6");
  });

  it("decodes the apostrophe in its three spellings", async () => {
    await expect(
      synopsisOf("It&#39;s &#039;ok&#039; &apos;x&apos;"),
    ).resolves.toBe("It's 'ok' 'x'");
  });

  it("decodes quotes, non-breaking spaces and ampersands", async () => {
    await expect(
      synopsisOf("&quot;Uno&quot;&nbsp;y&nbsp;otro &amp; mas"),
    ).resolves.toBe('"Uno" y otro & mas');
  });

  it("keeps a synopsis that is only markup out of the result", async () => {
    await expect(synopsisOf("<br><i></i>")).resolves.toBeUndefined();
  });
});

describe("searchAnime — request shape", () => {
  function variablesOfLastCall(): Record<string, unknown> {
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return JSON.parse(init.body as string).variables;
  }

  it("asks for the requested number of results", async () => {
    fetchMock.mockResolvedValue(pageResponse([media()]));

    await searchAnime("algo", { limit: 5 });

    expect(variablesOfLastCall()).toMatchObject({ perPage: 5 });
  });

  it("never asks for more than AniList's own per-page ceiling", async () => {
    fetchMock.mockResolvedValue(pageResponse([media()]));

    await searchAnime("algo", { limit: 500 });

    expect(variablesOfLastCall()).toMatchObject({ perPage: 50 });
  });

  it("asks for at least one result when given a nonsensical limit", async () => {
    fetchMock.mockResolvedValue(pageResponse([media()]));

    await searchAnime("algo", { limit: 0 });

    expect(variablesOfLastCall()).toMatchObject({ perPage: 1 });
  });
});

describe("searchAnime — cancellation", () => {
  function signalOfLastCall(): AbortSignal {
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return init.signal as AbortSignal;
  }

  /** Rejects the way a real `fetch` does when its signal is aborted, and
   * otherwise never settles. */
  function hangingFetch(): ReturnType<typeof vi.fn> {
    return vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          });
        }),
    );
  }

  it("still applies its own deadline when the caller supplies a signal", async () => {
    fetchMock.mockResolvedValue(pageResponse([media()]));
    const caller = new AbortController();

    await searchAnime("algo", { signal: caller.signal, timeoutMs: 5 });
    const signal = signalOfLastCall();

    await vi.waitFor(() => {
      expect(signal.aborted).toBe(true);
    });
  });

  it("comes back as unavailable when a search with a caller signal times out", async () => {
    fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const caller = new AbortController();

    await expect(
      searchAnime("algo", { signal: caller.signal, timeoutMs: 5 }),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("aborts the request when the caller aborts", async () => {
    fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const caller = new AbortController();

    const outcome = searchAnime("algo", { signal: caller.signal });
    caller.abort();

    await expect(outcome).resolves.toEqual({ status: "unavailable" });
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

  it("caps an absurd Retry-After instead of passing it to a timer", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({}, { status: 429, headers: { "retry-after": "99999999" } }),
    );

    await expect(searchAnime("death note")).resolves.toEqual({
      status: "rate_limited",
      retryAfterSeconds: 300,
    });
  });
});

describe("searchAnime — misconfiguration", () => {
  it("says so once in development, where a silent unavailable is a trap", async () => {
    vi.stubEnv("ANILIST_API_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await searchAnime("death note");

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("ANILIST_API_URL"),
    );
    warn.mockRestore();
  });

  it("stays quiet outside development", async () => {
    vi.stubEnv("ANILIST_API_URL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await searchAnime("death note");

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
