import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupCatalogItem, toClientPayload } from "../lookup";

describe("lookupCatalogItem", () => {
  const originalFetch = global.fetch;
  const originalRawg = process.env.RAWG_API_KEY;
  const originalDiscogs = process.env.DISCOGS_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAWG_API_KEY = "test-rawg-key";
    process.env.DISCOGS_TOKEN = "test-discogs-token";
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.RAWG_API_KEY = originalRawg;
    process.env.DISCOGS_TOKEN = originalDiscogs;
  });

  function jsonResponse(data: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => data,
    };
  }

  it("looks up a book by ISBN via Open Library", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("openlibrary.org/api/books")) {
          return jsonResponse({
            "ISBN:9780261102217": {
              title: "The Hobbit",
              authors: [{ name: "J.R.R. Tolkien" }],
              publishers: [{ name: "Allen & Unwin" }],
              publish_date: "1937",
              cover: { large: "https://covers.openlibrary.org/b/id/1-L.jpg" },
              identifiers: { isbn_13: ["9780261102217"] },
            },
          });
        }
        return jsonResponse({}, false, 404);
      }
    );

    const item = await lookupCatalogItem({ ean: "978-0-261-10221-7" });
    expect(item?.title).toBe("The Hobbit");
    expect(item?.artist_creator).toBe("J.R.R. Tolkien");
    expect(item?.category).toBe("book");
    expect(item?.cover_url).toContain("covers.openlibrary.org");
    expect(toClientPayload(item!).metadata.source).toBe("openlibrary");
  });

  it("takes the Open Library cover from another edition of the same title when the top hit has none", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("openlibrary.org/search.json")) {
          return jsonResponse({
            docs: [
              { title: "Szepty spoza nicości", author_name: ["Remigiusz Mróz"] },
              { title: "Inna książka", cover_i: 111 },
              { title: "Szepty spoza nicosci", author_name: ["Remigiusz Mróz"], cover_i: 10865291 },
            ],
          });
        }
        return jsonResponse({}, false, 404);
      }
    );

    const item = await lookupCatalogItem({ query: "Szepty spoza nicości Remigiusz Mróz", category: "book" });
    expect(item?.title).toBe("Szepty spoza nicości");
    expect(item?.cover_url).toBe("https://covers.openlibrary.org/b/id/10865291-L.jpg");
  });

  it("does not use the Open Library blank placeholder when no ISBN cover exists", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("openlibrary.org/search.json")) {
          return jsonResponse({ docs: [{ title: "Bez okładki", isbn: ["9788300000000"] }] });
        }
        return jsonResponse({}, false, 404);
      }
    );

    const item = await lookupCatalogItem({ query: "Bez okładki", category: "book" });
    expect(item?.title).toBe("Bez okładki");
    expect(item?.cover_url).toBeNull();
  });

  it("falls back to the ISBN cover when the book data has no cover", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("openlibrary.org/api/books")) {
          return jsonResponse({ "ISBN:9788382801234": { title: "Polska książka" } });
        }
        if (href.includes("covers.openlibrary.org/b/isbn/9788382801234") && init?.method === "HEAD") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return jsonResponse({}, false, 404);
      }
    );

    const item = await lookupCatalogItem({ ean: "9788382801234", category: "book" });
    expect(item?.cover_url).toBe(
      "https://covers.openlibrary.org/b/isbn/9788382801234-L.jpg?default=false"
    );
  });

  it("looks up music by barcode via MusicBrainz", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("musicbrainz.org") && decodeURIComponent(href).includes("barcode:7243")) {
          return jsonResponse({
            releases: [
              {
                id: "mbid-dsotm",
                title: "The Dark Side of the Moon",
                date: "1973-03-01",
                barcode: "724382119528",
                "artist-credit": [{ name: "Pink Floyd" }],
                "release-group": { "primary-type": "Album" },
              },
            ],
          });
        }
        if (href.includes("coverartarchive.org") && init?.method === "HEAD") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return jsonResponse({ results: [] });
      }
    );

    const item = await lookupCatalogItem({ ean: "724382119528" });
    expect(item?.title).toBe("The Dark Side of the Moon");
    expect(item?.artist_creator).toBe("Pink Floyd");
    expect(item?.category).toBe("music");
    expect(item?.cover_url).toContain("coverartarchive.org");
  });

  it("prefers a result whose title and artist match the query over a more complete one", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("musicbrainz.org")) {
          return jsonResponse({
            releases: [
              { id: "mbid-gb", title: "Gruby brzuch", "artist-credit": [{ name: "Grubson" }] },
            ],
          });
        }
        if (href.includes("coverartarchive.org") && init?.method === "HEAD") {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        if (href.includes("discogs.com")) {
          return jsonResponse({
            results: [
              {
                title: "Various - Brzuch Hits",
                year: "2010",
                cover_image: "https://i.discogs.com/other.jpg",
                format: ["CD"],
              },
            ],
          });
        }
        return jsonResponse({});
      }
    );

    const item = await lookupCatalogItem({ query: "Gruby Brzuch Grubson", category: "music" });
    expect(item?.title).toBe("Gruby brzuch");
    expect(item?.artist_creator).toBe("Grubson");
  });

  it("takes the cover from another release of the same album when the top hit has none", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("musicbrainz.org")) {
          return jsonResponse({
            releases: [
              {
                id: "mbid-bare",
                title: "The Dark Side of the Moon",
                "artist-credit": [{ name: "Pink Floyd" }],
                "release-group": { id: "rg-bare" },
              },
              {
                id: "mbid-art",
                title: "The Dark Side of the Moon",
                "artist-credit": [{ name: "Pink Floyd" }],
                "release-group": { id: "rg-art" },
              },
            ],
          });
        }
        if (href.includes("coverartarchive.org") && init?.method === "HEAD") {
          const ok = href.includes("mbid-art") || href.includes("rg-art");
          return { ok, status: ok ? 200 : 404, json: async () => ({}) };
        }
        return jsonResponse({}, false, 404);
      }
    );

    const item = await lookupCatalogItem({
      query: "Pink Floyd The Dark Side of the Moon",
      category: "music",
    });
    expect(item?.cover_url).toContain("coverartarchive.org");
    expect(item?.cover_url).toMatch(/mbid-art|rg-art/);
  });

  function musicBrainzQueries() {
    return (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes("musicbrainz.org"))
      .map((url) => new URL(url).searchParams.get("query"));
  }

  it("searches MusicBrainz by title and artist separately when both are known", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("musicbrainz.org")) {
          const query = new URL(href).searchParams.get("query");
          return jsonResponse({
            releases:
              query === 'release:"Kind of Blue" AND artist:"Miles Davis"'
                ? [{ id: "mbid-kob", title: "Kind of Blue", "artist-credit": [{ name: "Miles Davis" }] }]
                : [],
          });
        }
        if (href.includes("coverartarchive.org") && init?.method === "HEAD") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return jsonResponse({ results: [] });
      }
    );

    const item = await lookupCatalogItem({
      query: "Kind of Blue Miles Davis",
      title: "Kind of Blue",
      creator: "Miles Davis",
      category: "music",
    });
    expect(item?.title).toBe("Kind of Blue");
    expect(item?.cover_url).toContain("coverartarchive.org/release/mbid-kob");
  });

  it("falls back to a title-only MusicBrainz search when title and artist find nothing", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("musicbrainz.org")) {
          const query = new URL(href).searchParams.get("query");
          return jsonResponse({
            releases:
              query === 'release:"Gruby Brzuch"'
                ? [{ id: "mbid-gb", title: "Gruby Brzuch", "artist-credit": [{ name: "Brzuch" }] }]
                : [],
          });
        }
        if (href.includes("coverartarchive.org") && init?.method === "HEAD") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return jsonResponse({ results: [] });
      }
    );

    const item = await lookupCatalogItem({
      query: "Gruby Brzuch Bzrzuch",
      title: "Gruby Brzuch",
      creator: "Bzrzuch",
      category: "music",
    });
    expect(item?.title).toBe("Gruby Brzuch");
    expect(item?.cover_url).toContain("coverartarchive.org");
  });

  it("retries MusicBrainz once when it is rate limited (503)", async () => {
    vi.useFakeTimers();
    let musicBrainzCalls = 0;
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("musicbrainz.org")) {
          musicBrainzCalls += 1;
          if (musicBrainzCalls === 1) return jsonResponse({}, false, 503);
          return jsonResponse({
            releases: [{ id: "mbid-gb", title: "Gruby Brzuch", "artist-credit": [{ name: "Grubson" }] }],
          });
        }
        if (href.includes("coverartarchive.org") && init?.method === "HEAD") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return jsonResponse({ results: [] });
      }
    );

    const pending = lookupCatalogItem({ query: "Gruby Brzuch", category: "music" });
    await vi.runAllTimersAsync();
    const item = await pending;
    vi.useRealTimers();

    expect(musicBrainzCalls).toBe(2);
    expect(item?.cover_url).toContain("coverartarchive.org/release/mbid-gb");
  });

  it("uses the release-group cover when the release has no own artwork", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("musicbrainz.org")) {
          return jsonResponse({
            releases: [
              {
                id: "mbid-reissue",
                title: "Gruby Brzuch",
                "artist-credit": [{ name: "Grubson" }],
                "release-group": { id: "rg-gb", "primary-type": "Album" },
              },
            ],
          });
        }
        if (href.includes("coverartarchive.org/release/") && init?.method === "HEAD") {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        if (href.includes("coverartarchive.org/release-group/rg-gb") && init?.method === "HEAD") {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return jsonResponse({ results: [] });
      }
    );

    const item = await lookupCatalogItem({ query: "Gruby Brzuch", category: "music" });
    expect(item?.cover_url).toBe("https://coverartarchive.org/release-group/rg-gb/front-500");
  });

  it("checks MusicBrainz covers in parallel without following the slow Cover Art Archive redirect", async () => {
    const heads: Array<{ url: string; init?: RequestInit; resolve: (r: unknown) => void }> = [];
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("musicbrainz.org/ws/2/release")) {
          return Promise.resolve(
            jsonResponse({
              releases: [
                { id: "r1", title: "Abbey Road", "release-group": { id: "g1" } },
                { id: "r2", title: "Abbey Road", "release-group": { id: "g1" } },
                { id: "r3", title: "Abbey Road", "release-group": { id: "g3" } },
              ],
            })
          );
        }
        if (href.includes("coverartarchive.org") && init?.method === "HEAD") {
          return new Promise((resolve) => heads.push({ url: href, init, resolve }));
        }
        return Promise.resolve(jsonResponse({}, false, 404));
      }
    );

    const pending = lookupCatalogItem({ query: "Abbey Road", title: "Abbey Road", category: "music" });
    await vi.waitFor(() => expect(heads.length).toBe(5));
    // All candidates start together, in preference order; g1 is asked for once for both its releases.
    expect(heads.map((h) => h.url)).toEqual([
      "https://coverartarchive.org/release/r1/front-500",
      "https://coverartarchive.org/release-group/g1/front-500",
      "https://coverartarchive.org/release/r2/front-500",
      "https://coverartarchive.org/release/r3/front-500",
      "https://coverartarchive.org/release-group/g3/front-500",
    ]);
    expect(heads.every((h) => h.init?.redirect === "manual")).toBe(true);

    // CAA answers 307 (redirect to archive.org) when artwork exists and 404 when it does not.
    heads[0].resolve({ ok: false, status: 404 });
    heads[1].resolve({ ok: false, status: 404 });
    heads[2].resolve({ ok: false, status: 307 });
    heads[3].resolve({ ok: false, status: 307 });
    heads[4].resolve({ ok: false, status: 307 });
    const item = await pending;
    expect(item?.cover_url).toBe("https://coverartarchive.org/release/r2/front-500");
  });

  it("does not search MusicBrainz for free text as a single quoted phrase", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ results: [], releases: [] })
    );

    await lookupCatalogItem({ query: "Gruby Brzuch Brzuch", category: "music" });
    expect(musicBrainzQueries()).toEqual([
      "release:(Gruby Brzuch Brzuch) OR artist:(Gruby Brzuch Brzuch)",
    ]);
  });

  it("searches RAWG for games when category is game", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("api.rawg.io")) {
          return jsonResponse({
            results: [
              {
                name: "The Witcher 3",
                released: "2015-05-19",
                background_image: "https://media.rawg.io/witcher3.jpg",
                developers: [{ name: "CD Projekt RED" }],
                genres: [{ name: "RPG" }],
                platforms: [{ platform: { name: "PC" } }],
              },
            ],
          });
        }
        return jsonResponse({ results: [], docs: [] });
      }
    );

    const item = await lookupCatalogItem({ query: "Witcher 3", category: "game" });
    expect(item?.title).toBe("The Witcher 3");
    expect(item?.artist_creator).toBe("CD Projekt RED");
    expect(item?.category).toBe("game");
    expect(item?.subcategory).toBe("PC");
    // RAWG only has screenshots, so without IGDB credentials there is no cover.
    expect(item?.cover_url).toBeNull();
  });

  it("searches RAWG by the recognized title alone, without the studio that confuses its search", async () => {
    const searches: string[] = [];
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("api.rawg.io")) {
        searches.push(new URL(href).searchParams.get("search") ?? "");
        return jsonResponse({ results: [{ name: "Red Dead Redemption 2", released: "2018-10-26" }] });
      }
      return jsonResponse({ results: [], docs: [] });
    });

    const item = await lookupCatalogItem({
      query: "Red Dead Redemption 2 Rockstar Games",
      title: "Red Dead Redemption 2",
      creator: "Rockstar Games",
      category: "game",
    });
    expect(searches).toEqual(["Red Dead Redemption 2"]);
    expect(item?.title).toBe("Red Dead Redemption 2");
  });

  it("returns null when no provider matches", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ results: [], docs: [], releases: [] })
    );
    const item = await lookupCatalogItem({ query: "zzzz-unknown-item" });
    expect(item).toBeNull();
  });

  it("falls back to the original title when the localized game title finds nothing", async () => {
    process.env.IGDB_CLIENT_ID = "id";
    process.env.IGDB_CLIENT_SECRET = "secret";
    const searched: string[] = [];
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("api.rawg.io")) {
        const search = new URL(href).searchParams.get("search") ?? "";
        searched.push(search);
        return search === "Knowledge is Power"
          ? jsonResponse({ results: [{ name: "Knowledge is Power" }] })
          : jsonResponse({ results: [] });
      }
      if (href.includes("id.twitch.tv")) return jsonResponse({ access_token: "t", expires_in: 3600 });
      if (href.includes("api.igdb.com"))
        return jsonResponse([{ name: "Knowledge is Power", cover: { image_id: "kip" } }]);
      return jsonResponse({}, false, 404);
    });

    const item = await lookupCatalogItem({
      query: "Wiedza to potęga",
      title: "Wiedza to potęga",
      originalTitle: "Knowledge is Power",
      platform: "PS4",
      category: "game",
    });
    expect(searched).toEqual(["Wiedza to potęga", "Knowledge is Power"]);
    expect(item?.cover_url).toContain("/kip.jpg");
  });
});
