import { catalogFetch, readJson } from "../http";
import type { CatalogItem } from "../types";

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
    cover_url: game.background_image || null,
    metadata: {
      year: yearFromDate(game.released),
      platform,
      genre: game.genres?.[0]?.name,
      source: "rawg",
    },
    source: "rawg",
  };
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
  return fromGame(game);
}
