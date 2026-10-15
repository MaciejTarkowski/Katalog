import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchCatalog } from "../search";

type Routes = Record<string, unknown>;

/** Mocked catalog HTTP: first route whose key is contained in the URL wins; anything else is 404. */
function mockCatalog(routes: Routes) {
  global.fetch = vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;
    const body = routes[key];
    if (body === "error") return { ok: false, status: 500, json: async () => ({}) } as Response;
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

const pinkFloyd = {
  id: "rg-1",
  title: "The Dark Side of the Moon",
  "primary-type": "Album",
  "first-release-date": "1973-03-01",
  "artist-credit": [{ name: "Pink Floyd" }],
};

describe("searchCatalog", () => {
  const originalFetch = global.fetch;
  const originalRawg = process.env.RAWG_API_KEY;

  beforeEach(() => {
    process.env.RAWG_API_KEY = "test-rawg-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.RAWG_API_KEY = originalRawg;
  });

  it("puts the matching album before a book with the same title", async () => {
    mockCatalog({
      "openlibrary.org/search.json": {
        docs: [{ title: "Dark Side of the Moon", author_name: ["Sherrilyn Kenyon"], cover_i: 1 }],
      },
      "musicbrainz.org/ws/2/release-group": { "release-groups": [pinkFloyd] },
    });

    const results = await searchCatalog("Dark side of the moon");

    expect(results[0].artist_creator).toBe("Pink Floyd");
    expect(results[0].category).toBe("music");
    expect(results.map((r) => r.category)).toContain("book");
  });

  it("returns at most 5 results", async () => {
    mockCatalog({
      "openlibrary.org/search.json": {
        docs: Array.from({ length: 5 }, (_, i) => ({ title: `Spider-Man ${i}`, cover_i: i + 1 })),
      },
      "api.rawg.io": {
        results: Array.from({ length: 5 }, (_, i) => ({ name: `Spider-Man game ${i}` })),
      },
    });

    expect(await searchCatalog("Spider-Man")).toHaveLength(5);
  });

  it("returns games and comics for a title that exists in both", async () => {
    mockCatalog({
      "openlibrary.org/search.json": {
        docs: [{ title: "Spider-Man", subject: ["Comics"], cover_i: 7 }],
      },
      "api.rawg.io": {
        results: [{ name: "Marvel's Spider-Man", platforms: [{ platform: { name: "PlayStation 5" } }] }],
      },
    });

    const categories = (await searchCatalog("Spider-Man")).map((r) => r.category);
    expect(categories).toContain("game");
    expect(categories).toContain("comic");
  });

  it("skips a failing provider instead of failing the whole search", async () => {
    mockCatalog({
      "openlibrary.org/search.json": "error",
      "musicbrainz.org/ws/2/release-group": { "release-groups": [pinkFloyd] },
    });

    const results = await searchCatalog("Dark side of the moon");
    expect(results.map((r) => r.title)).toEqual(["The Dark Side of the Moon"]);
  });

  it("works without a RAWG key", async () => {
    delete process.env.RAWG_API_KEY;
    mockCatalog({
      "openlibrary.org/search.json": { docs: [{ title: "Hobbit", cover_i: 2 }] },
    });

    expect((await searchCatalog("Hobbit")).map((r) => r.title)).toEqual(["Hobbit"]);
  });

  it("drops duplicates of the same title and creator", async () => {
    mockCatalog({
      "musicbrainz.org/ws/2/release-group": { "release-groups": [pinkFloyd] },
      "api.discogs.com": {
        results: [{ title: "Pink Floyd - The Dark Side Of The Moon", year: "1973" }],
      },
    });

    expect(await searchCatalog("Dark side of the moon")).toHaveLength(1);
  });

  it("returns an empty list for a blank query", async () => {
    mockCatalog({});
    expect(await searchCatalog("   ")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
