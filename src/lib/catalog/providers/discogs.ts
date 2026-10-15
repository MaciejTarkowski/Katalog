import { catalogFetch, readJson } from "../http";
import type { CatalogItem } from "../types";

interface DiscogsSearchResult {
  title?: string;
  year?: string | number;
  cover_image?: string;
  thumb?: string;
  format?: string[];
  barcode?: string[];
  type?: string;
}

interface DiscogsSearchResponse {
  results?: DiscogsSearchResult[];
}

function splitArtistTitle(raw: string): { artist: string | null; title: string } {
  const parts = raw.split(" - ");
  if (parts.length < 2) return { artist: null, title: raw };
  return { artist: parts[0]?.trim() || null, title: parts.slice(1).join(" - ").trim() };
}

function usableCover(url?: string): string | null {
  if (!url) return null;
  if (url.includes("spacer.gif")) return null;
  return url;
}

function fromResult(result: DiscogsSearchResult): CatalogItem | null {
  if (!result.title) return null;
  const { artist, title } = splitArtistTitle(result.title);

  return {
    title,
    artist_creator: artist,
    category: "music",
    subcategory: result.format?.[0] || null,
    cover_url: usableCover(result.cover_image) || usableCover(result.thumb),
    metadata: {
      year: result.year ? String(result.year) : undefined,
      barcode: result.barcode?.[0],
      source: "discogs",
    },
    source: "discogs",
  };
}

async function search(params: URLSearchParams): Promise<CatalogItem | null> {
  const token = process.env.DISCOGS_TOKEN;
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Discogs token=${token}`;
  }

  const json = await readJson<DiscogsSearchResponse>(
    await catalogFetch(`https://api.discogs.com/database/search?${params.toString()}`, {
      headers,
    })
  );
  const result = json?.results?.[0];
  if (!result) return null;
  return fromResult(result);
}

export async function lookupDiscogsByBarcode(barcode: string): Promise<CatalogItem | null> {
  const params = new URLSearchParams({
    type: "release",
    barcode,
    per_page: "5",
  });
  return search(params);
}

export async function searchDiscogs(query: string): Promise<CatalogItem | null> {
  const params = new URLSearchParams({
    type: "release",
    q: query,
    per_page: "5",
  });
  return search(params);
}

/** Masters = one entry per album, not one per pressing. */
export async function searchDiscogsAlbums(query: string, limit = 5, offset = 0): Promise<CatalogItem[]> {
  const token = process.env.DISCOGS_TOKEN;
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Discogs token=${token}`;

  const params = new URLSearchParams({ type: "master", q: query, per_page: String(limit) });
  if (offset) params.set("page", String(Math.floor(offset / limit) + 1));
  const json = await readJson<DiscogsSearchResponse>(
    await catalogFetch(`https://api.discogs.com/database/search?${params.toString()}`, { headers })
  );
  return (json?.results ?? []).map(fromResult).filter((item): item is CatalogItem => Boolean(item));
}
