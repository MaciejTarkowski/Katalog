import {
  cleanSearchQuery,
  extractEanFromText,
  isIsbnPrefix,
  normalizeEan,
  normalizeForMatch,
} from "./normalize";
import { lookupDiscogsByBarcode, searchDiscogs } from "./providers/discogs";
import {
  lookupMusicBrainzByBarcode,
  searchMusicBrainz,
} from "./providers/musicBrainz";
import { lookupOpenLibraryByIsbn, searchOpenLibrary } from "./providers/openLibrary";
import { searchRawg } from "./providers/rawg";
import { isCatalogCategory, type CatalogItem, type LookupInput } from "./types";

/** Whole-word containment, so "Brzuch" alone does not match the query "Gruby Brzuch". */
function queryContains(query: string, part: string | null): boolean {
  const p = normalizeForMatch(part ?? "");
  return Boolean(p) && ` ${normalizeForMatch(query)} `.includes(` ${p} `);
}

function scoreItem(item: CatalogItem, categoryHint?: string, query?: string): number {
  let score = 0;
  if (query && queryContains(query, item.title)) score += 4;
  if (query && queryContains(query, item.artist_creator)) score += 2;
  if (item.title) score += 2;
  if (item.artist_creator) score += 1;
  if (item.cover_url) score += 2;
  if (item.metadata?.year) score += 1;
  if (categoryHint && item.category === categoryHint) score += 3;
  return score;
}

function pickBest(
  items: CatalogItem[],
  categoryHint?: string,
  query?: string
): CatalogItem | null {
  const valid = items.filter((item) => item.title);
  if (!valid.length) return null;
  return [...valid].sort(
    (a, b) => scoreItem(b, categoryHint, query) - scoreItem(a, categoryHint, query)
  )[0];
}

async function settled(tasks: Array<Promise<CatalogItem | null>>): Promise<CatalogItem[]> {
  const results = await Promise.allSettled(tasks);
  return results
    .filter((result): result is PromiseFulfilledResult<CatalogItem | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((item): item is CatalogItem => Boolean(item));
}

async function lookupByEan(ean: string, categoryHint?: string): Promise<CatalogItem | null> {
  const isbnLike = isIsbnPrefix(ean);
  const preferBooks =
    categoryHint === "book" || categoryHint === "comic" || (!categoryHint && isbnLike);
  const preferMusic = categoryHint === "music" || (!categoryHint && !isbnLike);

  const tasks: Array<Promise<CatalogItem | null>> = [];

  if (!categoryHint || preferBooks || categoryHint === "other") {
    tasks.push(lookupOpenLibraryByIsbn(ean));
  }
  if (!categoryHint || preferMusic || categoryHint === "other") {
    tasks.push(lookupMusicBrainzByBarcode(ean));
    tasks.push(lookupDiscogsByBarcode(ean));
  }

  return pickBest(await settled(tasks), categoryHint);
}

async function lookupByQuery(
  query: string,
  categoryHint?: string,
  known?: Pick<LookupInput, "title" | "creator">
): Promise<CatalogItem | null> {
  const q = cleanSearchQuery(query);
  if (!q) return null;

  if (categoryHint === "book" || categoryHint === "comic") {
    return searchOpenLibrary(q, categoryHint);
  }
  if (categoryHint === "music") {
    return pickBest(await settled([searchMusicBrainz(q, known), searchDiscogs(q)]), categoryHint, q);
  }
  if (categoryHint === "game") {
    return searchRawg(q);
  }

  return pickBest(
    await settled([
      searchOpenLibrary(q),
      searchMusicBrainz(q, known),
      searchDiscogs(q),
      searchRawg(q),
    ]),
    categoryHint,
    q
  );
}

export async function lookupCatalogItem(input: LookupInput): Promise<CatalogItem | null> {
  const categoryHint = isCatalogCategory(input.category) ? input.category : undefined;
  const ean = input.ean ? normalizeEan(input.ean) : null;
  const query = input.query ? cleanSearchQuery(input.query) : "";

  if (ean) {
    const byEan = await lookupByEan(ean, categoryHint);
    if (byEan) return byEan;
  }

  if (query) {
    const extracted = extractEanFromText(query);
    if (extracted && extracted !== ean) {
      const fromText = await lookupByEan(extracted, categoryHint);
      if (fromText) return fromText;
    }
    return lookupByQuery(query, categoryHint, { title: input.title, creator: input.creator });
  }

  return null;
}

export function toClientPayload(item: CatalogItem) {
  return {
    title: item.title,
    artist_creator: item.artist_creator,
    category: item.category,
    subcategory: item.subcategory,
    cover_url: item.cover_url,
    metadata: {
      ...item.metadata,
      source: item.source,
    },
  };
}
