import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchRawg, searchRawgMany } from "../rawg";
import { resetIgdbTokenCache } from "../igdb";

const game = {
  name: "1-2-Switch",
  released: "2017-03-03",
  background_image: "https://media.rawg.io/screenshot.jpg",
  platforms: [{ platform: { name: "Nintendo Switch" } }],
};

function json(data: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => data };
}

describe("RAWG + IGDB covers", () => {
  const originalFetch = global.fetch;
  const env = { ...process.env };

  beforeEach(() => {
    process.env.RAWG_API_KEY = "rawg";
    process.env.IGDB_CLIENT_ID = "id";
    process.env.IGDB_CLIENT_SECRET = "secret";
    resetIgdbTokenCache();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...env };
  });

  function mockApis(igdbGames: unknown[]) {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("api.rawg.io")) return json({ results: [game] });
      if (href.includes("id.twitch.tv")) return json({ access_token: "tok", expires_in: 3600 });
      if (href.includes("api.igdb.com")) return json(igdbGames);
      return json({}, false, 404);
    });
  }

  it("uses the IGDB cover, never the RAWG screenshot", async () => {
    mockApis([{ name: "1-2-Switch", cover: { image_id: "co1abc" } }]);
    const item = await searchRawg("1-2 Switch");
    expect(item?.cover_url).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg");
  });

  it("returns no cover instead of the RAWG screenshot when IGDB has none", async () => {
    mockApis([]);
    const [item] = await searchRawgMany("1-2 Switch");
    expect(item.cover_url).toBeNull();
  });

  it("returns no cover when IGDB credentials are missing", async () => {
    delete process.env.IGDB_CLIENT_ID;
    mockApis([{ name: "1-2-Switch", cover: { image_id: "co1abc" } }]);
    const item = await searchRawg("1-2 Switch");
    expect(item?.cover_url).toBeNull();
  });

  it("never takes another game's cover when IGDB has no game with that title (A Way Out)", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("api.rawg.io")) return json({ results: [{ name: "A Way Out", platforms: [] }] });
      if (href.includes("id.twitch.tv")) return json({ access_token: "tok", expires_in: 3600 });
      if (href.includes("api.igdb.com")) return json([{ name: "Way of the Samurai", cover: { image_id: "wrong" } }]);
      return json({}, false, 404);
    });
    const item = await searchRawg("A Way Out", "PS4");
    expect(item?.cover_url).toBeNull();
  });

  it("prefers the release on the scanned platform", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes("api.rawg.io"))
        return json({
          results: [
            { name: "Diablo III", platforms: [{ platform: { name: "PC" } }] },
            { name: "Diablo III", platforms: [{ platform: { name: "PlayStation 3" } }] },
          ],
        });
      if (href.includes("id.twitch.tv")) return json({ access_token: "tok", expires_in: 3600 });
      if (href.includes("api.igdb.com"))
        return json([
          { name: "Diablo III", cover: { image_id: "pc" }, platforms: [{ abbreviation: "PC" }] },
          { name: "Diablo III", cover: { image_id: "ps3" }, platforms: [{ abbreviation: "PS3" }] },
        ]);
      return json({}, false, 404);
    });
    const item = await searchRawg("Diablo III", "PS3");
    expect(item?.subcategory).toBe("PlayStation 3");
    expect(item?.cover_url).toContain("/ps3.jpg");
  });
});
