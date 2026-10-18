import { createClient } from "@/lib/supabase/client";
import { Profile, SharedProfile } from "@/types/database";
import { isKnownCategory } from "@/lib/items/display";
import { t } from "@/lib/i18n/locale";
import type { Locale } from "@/lib/i18n/config";

export const DISPLAY_NAME_MAX_LENGTH = 50;

export async function fetchProfile(
  userId: string
): Promise<{ data: Profile | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, collection_types, language, share_enabled")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data as Profile) || null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("profile.error.fetch");
    return { data: null, error: message };
  }
}

/**
 * Name and categories of a collection its owner has shared (RPC `shared_profile`).
 * `data` is null when the user does not exist or does not share the collection.
 */
export async function fetchSharedProfile(
  userId: string
): Promise<{ data: SharedProfile | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("shared_profile", { p_user_id: userId });
    if (error) {
      return { data: null, error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return { data: (row as SharedProfile | undefined) ?? null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("profile.error.fetch");
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
    const message = err instanceof Error ? err.message : t("profile.error.saveName");
    return { data: profile.data, error: message };
  }
}

export async function updateDisplayName(
  name: string
): Promise<{ success: boolean; error: string | null }> {
  const displayName = name.trim();
  if (!displayName || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return { success: false, error: t("profile.error.nameLength", { max: DISPLAY_NAME_MAX_LENGTH }) };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: t("auth.notLoggedIn") };
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: displayName });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("profile.error.saveName");
    return { success: false, error: message };
  }
}

/** Saves which item categories the current user keeps; items of other categories stay in the database. */
export async function updateCollectionTypes(
  types: string[]
): Promise<{ success: boolean; error: string | null }> {
  if (types.length === 0 || !types.every(isKnownCategory)) {
    return { success: false, error: t("types.pickOne") };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: t("auth.notLoggedIn") };
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, collection_types: types });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("types.error.save");
    return { success: false, error: message };
  }
}

/** Saves the UI language of the current user, so it follows them to other devices. */
export async function updateLanguage(language: Locale): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: t("auth.notLoggedIn") };
    }

    const { error } = await supabase.from("profiles").upsert({ id: user.id, language });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("profile.error.saveLanguage");
    return { success: false, error: message };
  }
}

/** Turns the public link to the current user's collection on or off (private by default). */
export async function updateShareEnabled(enabled: boolean): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: t("auth.notLoggedIn") };
    }

    const { error } = await supabase.from("profiles").upsert({ id: user.id, share_enabled: enabled });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("share.error.save");
    return { success: false, error: message };
  }
}
