import type { Item } from "@/types/database";

export interface ItemDescription {
  description: string;
  url: string;
}

/**
 * Short description for the item's detail view (Polish Wikipedia, via /api/catalog/description).
 * null: there is none; undefined: the lookup failed and may be retried later.
 */
export async function fetchItemDescription(item: Item): Promise<ItemDescription | null | undefined> {
  try {
    const res = await fetch("/api/catalog/description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: item.title, creator: item.artist_creator, category: item.category }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) return undefined;
    return (json.data as ItemDescription | null) ?? null;
  } catch {
    return undefined;
  }
}
