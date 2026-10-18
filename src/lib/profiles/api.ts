import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";
import { CATEGORIES } from "@/lib/items/display";

export const DISPLAY_NAME_MAX_LENGTH = 50;

export async function fetchProfile(
  userId: string
): Promise<{ data: Profile | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, collection_types")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data as Profile) || null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Błąd podczas pobierania profilu";
    return { data: null, error: message };
  }
}

/** Name from auth metadata: our sign-up form sets display_name, Google sets full_name / name. */
export function nameFromMetadata(metadata: Record<string, unknown> | undefined): string {
  for (const key of ["display_name", "full_name", "name"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
    }
  }
  return "";
}

/**
 * Fetches the profile and, when it is missing or has no name, saves `fallbackName`
 * (e.g. after a Google sign-in that the `handle_new_user` trigger could not name).
 */
export async function ensureProfile(
  userId: string,
  fallbackName: string
): Promise<{ data: Profile | null; error: string | null }> {
  const profile = await fetchProfile(userId);
  if (profile.error || profile.data?.display_name || !fallbackName) {
    return profile;
  }

  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: fallbackName });

    if (error) {
      return { data: profile.data, error: error.message };
    }

    return { data: { ...profile.data, id: userId, display_name: fallbackName }, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Błąd podczas zapisywania nazwy";
    return { data: profile.data, error: message };
  }
}

export async function updateDisplayName(
  name: string
): Promise<{ success: boolean; error: string | null }> {
  const displayName = name.trim();
  if (!displayName || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return { success: false, error: `Nazwa musi mieć od 1 do ${DISPLAY_NAME_MAX_LENGTH} znaków.` };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "Użytkownik nie jest zalogowany" };
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: displayName });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Błąd podczas zapisywania nazwy";
    return { success: false, error: message };
  }
}

/** Saves which item categories the current user keeps; items of other categories stay in the database. */
export async function updateCollectionTypes(
  types: string[]
): Promise<{ success: boolean; error: string | null }> {
  if (types.length === 0 || !types.every((t) => CATEGORIES.some((c) => c.value === t))) {
    return { success: false, error: "Wybierz co najmniej jeden typ." };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "Użytkownik nie jest zalogowany" };
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, collection_types: types });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Błąd podczas zapisywania typów";
    return { success: false, error: message };
  }
}
