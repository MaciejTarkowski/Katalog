import { cleanSearchQuery, normalizeForMatch } from "./normalize";
import { searchDiscogsAlbums } from "./providers/discogs";
import { searchMusicBrainzAlbums } from "./providers/musicBrainz";
import { searchOpenLibraryMany } from "./providers/openLibrary";
import { searchRawgMany } from "./providers/rawg";
import type { CatalogItem } from "./types";

export const SEARCH_LIMIT = 25;

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

/** Free-text search across all catalogs: the best `SEARCH_LIMIT` distinct matches, most relevant first. */
export async function searchCatalog(rawQuery: string): Promise<CatalogItem[]> {
  const query = cleanSearchQuery(rawQuery);
  if (!query) return [];

  const lists = await Promise.all([
    safely(searchOpenLibraryMany(query)),
    safely(searchMusicBrainzAlbums(query)),
    safely(searchDiscogsAlbums(query)),
    safely(searchRawgMany(query)),
  ]);

  const seen = new Set<string>();
  return lists
    .flatMap((items) =>
      items
        .filter((item) => item.title)
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
}
