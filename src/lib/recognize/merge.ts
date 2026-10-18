import { textsOverlap } from "../catalog/normalize";
import type { CatalogItem } from "../catalog/types";
import type { RecognizedCover } from "./gemini";

/**
 * Combines the vision result (what is on the cover) with an optional catalog hit
 * (cover image, year, publisher). Title, creator, category and subcategory come
 * from the recognition so a loosely matching catalog hit cannot replace them.
 */
export function mergeRecognition(recognized: RecognizedCover, item: CatalogItem | null) {
  const match =
    item &&
    (textsOverlap(item.title, recognized.title) ||
      (recognized.originalTitle && textsOverlap(item.title, recognized.originalTitle)))
      ? item
      : null;

  return {
    title: recognized.title,
    artist_creator: recognized.creator ?? match?.artist_creator ?? null,
    category: recognized.category,
    subcategory: recognized.subcategory ?? match?.subcategory ?? null,
    cover_url: match?.cover_url ?? null,
    ...(recognized.box ? { cover_box: recognized.box } : {}),
    metadata: {
      ...(match?.metadata ?? {}),
      ...(recognized.subcategory && recognized.category === "game"
        ? { platform: recognized.subcategory }
        : {}),
      ...(recognized.originalTitle ? { original_title: recognized.originalTitle } : {}),
      source: match ? `gemini+${match.source}` : "gemini",
    },
  };
}
