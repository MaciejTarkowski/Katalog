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
    expect(item?.cover_url).toBe("https://media.rawg.io/witcher3.jpg");
  });

  it("returns null when no provider matches", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ results: [], docs: [], releases: [] })
    );
    const item = await lookupCatalogItem({ query: "zzzz-unknown-item" });
    expect(item).toBeNull();
  });
});
