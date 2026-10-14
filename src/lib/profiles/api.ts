import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";

export const DISPLAY_NAME_MAX_LENGTH = 50;

export async function fetchProfile(
  userId: string
): Promise<{ data: Profile | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
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
