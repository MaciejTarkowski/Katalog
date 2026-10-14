import { createClient } from "@/lib/supabase/client";
import { Item, ItemInsert } from "@/types/database";

export async function fetchItems(category?: string): Promise<{ data: Item[] | null; error: string | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: null, error: "Użytkownik nie jest zalogowany" };
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
    const message = err instanceof Error ? err.message : "Błąd podczas pobierania elementów";
    return { data: null, error: message };
  }
}

export async function fetchPublicItems(
  userId: string,
  category?: string
): Promise<{ data: Item[] | null; error: string | null }> {
  try {
    const supabase = createClient();
    let query = supabase
      .from("items")
      .select("*")
      .eq("user_id", userId)
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
    const message = err instanceof Error ? err.message : "Błąd podczas pobierania publicznych elementów";
    return { data: null, error: message };
  }
}

export async function fetchItemById(
  id: string
): Promise<{ data: Item | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("items").select("*").eq("id", id).maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }
    if (!data) {
      return { data: null, error: "Nie znaleziono elementu." };
    }

    return { data: data as Item, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Błąd podczas pobierania elementu";
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
      return { data: null, error: "Użytkownik nie jest zalogowany" };
    }

    const itemToInsert = {
      ...item,
      user_id: user.id,
      metadata: item.metadata || {},
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
    const message = err instanceof Error ? err.message : "Błąd podczas dodawania elementu";
    return { data: null, error: message };
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
    const message = err instanceof Error ? err.message : "Błąd podczas usuwania elementu";
    return { success: false, error: message };
  }
}
