import { createClient } from "@/lib/supabase/client";
import { CommunityItem, Item, ItemInsert } from "@/types/database";
import { t } from "@/lib/i18n/locale";
import { canonicalTerm, displayTerm } from "./terms";

export async function fetchItems(category?: string): Promise<{ data: Item[] | null; error: string | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: null, error: t("auth.notLoggedIn") };
    }

    // RLS allows public read (share links), so scope to the owner explicitly.
    let query = supabase
      .from("items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data as Item[]) || [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("items.error.fetch");
    return { data: null, error: message };
  }
}

/** Items of a collection its owner has shared (RPC `shared_items`); empty while sharing is off. */
export async function fetchPublicItems(
  userId: string,
  category?: string
): Promise<{ data: Item[] | null; error: string | null }> {
  try {
    const supabase = createClient();
    let query = supabase.rpc("shared_items", { p_user_id: userId });

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data as Item[]) || [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("items.error.fetchPublic");
    return { data: null, error: message };
  }
}

/**
 * One item. Your own collection is read from the table; with `shared` (a guest opening an item from a
 * /share link) through the RPC `shared_item`, which answers only while the owner shares the collection.
 */
export async function fetchItemById(
  id: string,
  { shared = false }: { shared?: boolean } = {}
): Promise<{ data: Item | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = shared
      ? await supabase.rpc("shared_item", { p_id: id }).maybeSingle()
      : await supabase.from("items").select("*").eq("id", id).maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }
    if (!data) {
      return { data: null, error: t("items.error.notFound") };
    }

    return { data: data as Item, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("items.error.fetchOne");
    return { data: null, error: message };
  }
}

export async function addItem(
  item: Omit<ItemInsert, "id" | "user_id" | "created_at" | "updated_at">
): Promise<{ data: Item | null; error: string | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: null, error: t("auth.notLoggedIn") };
    }

    // Same title can legitimately appear more than once under a different subcategory
    // (e.g. a game on PS5 vs PC, a book in hardcover vs paperback) — only an exact match
    // of title + category + subcategory counts as a duplicate.
    // Known formats/genres are saved as codes ("Winyl" → "vinyl"), so they can be shown in any UI language.
    const subcategory = canonicalTerm(item.subcategory);
    const genre = typeof item.metadata?.genre === "string" ? canonicalTerm(item.metadata.genre) : undefined;
    const normalizedTitle = item.title.trim().toLowerCase();
    const normalizedSubcategory = (subcategory || "").toLowerCase();
    const { data: existing, error: existingError } = await supabase
      .from("items")
      .select("title, category, subcategory")
      .eq("user_id", user.id);

    if (existingError) {
      return { data: null, error: existingError.message };
    }
    const isDuplicate = (
      (existing as { title: string; category: string; subcategory: string | null }[] | null) || []
    ).some(
      (row) =>
        row.title.trim().toLowerCase() === normalizedTitle &&
        row.category === item.category &&
        (canonicalTerm(row.subcategory) || "").toLowerCase() === normalizedSubcategory
    );
    if (isDuplicate) {
      const withSub = subcategory ? ` (${displayTerm(subcategory, t)})` : "";
      return { data: null, error: t("items.duplicate", { title: item.title.trim(), sub: withSub }) };
    }

    const itemToInsert = {
      ...item,
      subcategory,
      user_id: user.id,
      metadata: genre ? { ...item.metadata, genre } : item.metadata || {},
    };

    const { data, error } = await supabase
      .from("items")
      .insert([itemToInsert])
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Item, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("items.error.add");
    return { data: null, error: message };
  }
}

/** Replaces the item's metadata (owner only, by RLS) — e.g. to store a looked-up description. */
export async function updateItemMetadata(
  id: string,
  metadata: Record<string, unknown>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("items").update({ metadata }).eq("id", id);
    return error ? { success: false, error: error.message } : { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("items.error.save");
    return { success: false, error: message };
  }
}

export async function deleteItem(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("items").delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("items.error.delete");
    return { success: false, error: message };
  }
}

/**
 * Searches other users' items (public read RLS) by title or creator — the fallback
 * when recognition and the catalog APIs find nothing. Returns each title once,
 * without owner data.
 */
export async function searchCommunityItems(
  query: string
): Promise<{ data: CommunityItem[] | null; error: string | null }> {
  // Characters that would break the PostgREST `or` filter or act as wildcards.
  const term = query.replace(/[,()%*_\\"]/g, " ").replace(/\s+/g, " ").trim();
  if (term.length < 2) {
    return { data: [], error: null };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let request = supabase
      .from("items")
      .select("title, artist_creator, category, subcategory, cover_url, metadata")
      .or(`title.ilike.%${term}%,artist_creator.ilike.%${term}%`);
    if (user) {
      request = request.neq("user_id", user.id);
    }

    const { data, error } = await request.order("created_at", { ascending: false }).limit(50);
    if (error) {
      return { data: null, error: error.message };
    }

    const seen = new Set<string>();
    const unique: CommunityItem[] = [];
    for (const row of (data as CommunityItem[]) || []) {
      const key = [row.title, row.artist_creator ?? "", row.category]
        .map((part) => part.trim().toLowerCase())
        .join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({
        title: row.title,
        artist_creator: row.artist_creator,
        category: row.category,
        subcategory: row.subcategory,
        cover_url: row.cover_url,
        metadata: row.metadata ?? {},
      });
    }
    return { data: unique, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("items.error.searchCommunity");
    return { data: null, error: message };
  }
}
