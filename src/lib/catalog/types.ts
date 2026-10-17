export const CATALOG_CATEGORIES = [
  "book",
  "music",
  "game",
  "comic",
  "other",
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export interface CatalogItem {
  title: string;
  artist_creator: string | null;
  category: CatalogCategory;
  subcategory: string | null;
  cover_url: string | null;
  metadata: Record<string, unknown>;
  source: string;
}

export interface LookupInput {
  ean?: string;
  query?: string;
  /** Title and creator as recognized on the cover, when known separately from `query`. */
  title?: string;
  creator?: string | null;
  /** International / original title, tried when the cover's (e.g. Polish) title finds nothing. */
  originalTitle?: string | null;
  /** Console for games ("PS4", "PS3"…); picks the right release and cover. */
  platform?: string | null;
  category?: CatalogCategory | string;
}

export function isCatalogCategory(value: unknown): value is CatalogCategory {
  return (
    typeof value === "string" &&
    (CATALOG_CATEGORIES as readonly string[]).includes(value)
  );
}
