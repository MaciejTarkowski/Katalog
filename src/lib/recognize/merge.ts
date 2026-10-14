import type { CatalogItem } from "../catalog/types";
import type { RecognizedCover } from "./gemini";

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Provider results are only trusted when their title matches what was seen on the cover. */
export function titlesMatch(a: string, b: string): boolean {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  return Boolean(x && y) && (x.includes(y) || y.includes(x));
}

/**
 * Combines the vision result (what is on the cover) with an optional catalog hit
 * (cover image, year, publisher). Title, creator, category and subcategory come
 * from the recognition so a loosely matching catalog hit cannot replace them.
 */
export function mergeRecognition(recognized: RecognizedCover, item: CatalogItem | null) {
  const match = item && titlesMatch(item.title, recognized.title) ? item : null;

  return {
    title: recognized.title,
    artist_creator: recognized.creator ?? match?.artist_creator ?? null,
    category: recognized.category,
    subcategory: recognized.subcategory ?? match?.subcategory ?? null,
    cover_url: match?.cover_url ?? null,
    metadata: {
      ...(match?.metadata ?? {}),
      ...(recognized.subcategory && recognized.category === "game"
        ? { platform: recognized.subcategory }
        : {}),
      source: match ? `gemini+${match.source}` : "gemini",
    },
  };
}
