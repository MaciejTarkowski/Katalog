import { catalogFetch, readJson } from "../http";
import type { CatalogItem } from "../types";
import { findIgdbCover } from "./igdb";

interface RawgGame {
  name?: string;
  released?: string;
  background_image?: string;
  developers?: Array<{ name?: string }>;
  genres?: Array<{ name?: string }>;
  platforms?: Array<{ platform?: { name?: string } }>;
}

interface RawgSearchResponse {
  results?: RawgGame[];
}

function yearFromDate(value?: string): string | undefined {
  return value?.match(/\d{4}/)?.[0];
}

function fromGame(game: RawgGame): CatalogItem | null {
  if (!game.name) return null;
  const platform = game.platforms?.[0]?.platform?.name || null;

  return {
    title: game.name,
    artist_creator: game.developers?.[0]?.name || null,
    category: "game",
    subcategory: platform,
    // RAWG's background_image is a screenshot, not box art; the cover comes from IGDB (withIgdbCover).
    cover_url: null,
    metadata: {
      year: yearFromDate(game.released),
      platform,
      genre: game.genres?.[0]?.name,
      source: "rawg",
    },
    source: "rawg",
  };
}

async function withIgdbCover(item: CatalogItem | null): Promise<CatalogItem | null> {
  if (!item) return null;
  return { ...item, cover_url: await findIgdbCover(item.title) };
}

export async function searchRawg(query: string): Promise<CatalogItem | null> {
  const key = process.env.RAWG_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    key,
    search: query,
    page_size: "5",
  });

  const json = await readJson<RawgSearchResponse>(
    await catalogFetch(`https://api.rawg.io/api/games?${params.toString()}`)
  );
  const game = json?.results?.[0];
  if (!game) return null;
  return withIgdbCover(fromGame(game));
}

export async function searchRawgMany(query: string, limit = 5, offset = 0): Promise<CatalogItem[]> {
  const key = process.env.RAWG_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({ key, search: query, page_size: String(limit) });
  if (offset) params.set("page", String(Math.floor(offset / limit) + 1));
  const json = await readJson<RawgSearchResponse>(
    await catalogFetch(`https://api.rawg.io/api/games?${params.toString()}`)
  );
  const items = await Promise.all((json?.results ?? []).map((game) => withIgdbCover(fromGame(game))));
  return items.filter((item): item is CatalogItem => Boolean(item));
}
