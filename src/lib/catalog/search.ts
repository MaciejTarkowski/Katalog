import { cleanSearchQuery, normalizeForMatch } from "./normalize";
import { searchDiscogsAlbums } from "./providers/discogs";
import { searchMusicBrainzAlbums } from "./providers/musicBrainz";
import { searchOpenLibraryMany } from "./providers/openLibrary";
import { searchRawgMany } from "./providers/rawg";
import { SEARCH_LIMIT } from "./searchConfig";
import type { CatalogItem } from "./types";

export { SEARCH_LIMIT };

/** Wins ties between equally good title matches (an album over a book with the same name). */
const CATEGORY_PRIORITY: Record<string, number> = { music: 3, game: 2, book: 1, comic: 0 };

/** Normalized text without leading articles, so "The Dark Side of the Moon" equals "Dark Side of the Moon". */
function comparable(value: string | null): string {
  return normalizeForMatch(value ?? "").replace(/^(the|a|an) /, "");
}

function relevance(item: CatalogItem, query: string, rank: number): number {
  const q = comparable(query);
  const title = comparable(item.title);
  const creator = comparable(item.artist_creator);
  const words = q.split(" ").filter(Boolean);

  let score = 0;
  if (title === q) score += 12;
  else if (title.startsWith(q)) score += 8;
  else if (title.includes(q)) score += 6;
  else if (words.length && words.every((w) => title.includes(w))) score += 5;
  else if (creator && (` ${q} `.includes(` ${creator} `) || creator.includes(q))) score += 4;
  else if (words.some((w) => title.includes(w) || creator.includes(w))) score += 1;

  if (item.cover_url) score += 0.3; // only breaks ties
  score += Math.max(0, 3 - rank); // the provider's own ordering is a relevance signal
  score += (CATEGORY_PRIORITY[item.category] ?? 0) * 0.2;
  return score;
}

async function safely(task: Promise<CatalogItem[]>): Promise<CatalogItem[]> {
  try {
    return await task;
  } catch {
    return [];
  }
}

export type SearchCategory = "music" | "game" | "book" | "comic";
export const SEARCH_CATEGORIES: readonly SearchCategory[] = ["music", "game", "book", "comic"];

export interface SearchOptions {
  category?: SearchCategory;
  /** Several categories at once (the ones kept in the user's catalog); ignored when `category` is set. */
  categories?: readonly SearchCategory[];
  /** How many results of this search were already delivered (a multiple of `SEARCH_LIMIT`). */
  offset?: number;
}

export interface SearchPage {
  items: CatalogItem[];
  hasMore: boolean;
}

type Provider = (query: string, limit: number, offset: number) => Promise<CatalogItem[]>;

const PROVIDERS: Record<SearchCategory, Provider[]> = {
  music: [searchMusicBrainzAlbums, searchDiscogsAlbums],
  game: [searchRawgMany],
  book: [searchOpenLibraryMany],
  comic: [searchOpenLibraryMany],
};
const ALL_PROVIDERS: Provider[] = [
  searchOpenLibraryMany,
  searchMusicBrainzAlbums,
  searchDiscogsAlbums,
  searchRawgMany,
];

/**
 * Free-text search: one page of `SEARCH_LIMIT` distinct matches, most relevant first. With a category only
 * its providers are asked; the page size is split evenly between them so every category yields the same number.
 */
export async function searchCatalog(rawQuery: string, options: SearchOptions = {}): Promise<SearchPage> {
  const query = cleanSearchQuery(rawQuery);
  if (!query) return { items: [], hasMore: false };

  const { category, offset = 0 } = options;
  const allowed: readonly SearchCategory[] | undefined = category ? [category] : options.categories;
  if (allowed && allowed.length === 0) return { items: [], hasMore: false };
  const providers = allowed ? [...new Set(allowed.flatMap((c) => PROVIDERS[c]))] : ALL_PROVIDERS;
  const perProvider = Math.ceil(SEARCH_LIMIT / providers.length);
  const providerOffset = Math.floor(offset / providers.length);

  const lists = await Promise.all(
    providers.map((provider) => safely(provider(query, perProvider, providerOffset)))
  );
  const hasMore = lists.some((items) => items.length >= perProvider);

  const seen = new Set<string>();
  const items = lists
    .flatMap((list) =>
      list
        .filter((item) => item.title && (!allowed || (allowed as readonly string[]).includes(item.category)))
        .map((item, rank) => ({ item, score: relevance(item, query, rank) }))
    )
    .sort((a, b) => b.score - a.score)
    .filter(({ item }) => {
      const key = `${item.category}|${comparable(item.title)}|${comparable(item.artist_creator)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, SEARCH_LIMIT)
    .map(({ item }) => item);
  return { items, hasMore };
}
