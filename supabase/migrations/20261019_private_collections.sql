-- Kolekcje są prywatne. Publiczny odczyt tylko przez link /share/<userId> i tylko wtedy,
-- gdy właściciel włączył udostępnianie (profiles.share_enabled). Uruchom raz w Supabase SQL Editor.
--
-- UWAGA: dotychczasowe linki /share/... przestaną działać, dopóki właściciel nie włączy udostępniania
-- w zakładce Udostępnij (domyślnie false).

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT false;

-- Tabele czyta tylko właściciel (wcześniej: każdy).
DROP POLICY IF EXISTS "Anyone can view public items" ON public.items;
DROP POLICY IF EXISTS "Users can view own items" ON public.items;
CREATE POLICY "Users can view own items"
    ON public.items
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Udostępniona kolekcja: tylko znając userId i tylko po włączeniu udostępniania (nie da się jej wylistować).
CREATE OR REPLACE FUNCTION public.shared_profile(p_user_id UUID)
RETURNS TABLE (display_name TEXT, collection_types TEXT[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.display_name, p.collection_types
    FROM public.profiles p
    WHERE p.id = p_user_id AND p.share_enabled;
$$;

CREATE OR REPLACE FUNCTION public.shared_items(p_user_id UUID)
RETURNS SETOF public.items
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT i.*
    FROM public.items i
    WHERE i.user_id = p_user_id
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id AND p.share_enabled)
    ORDER BY i.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.shared_profile(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shared_items(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shared_profile(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shared_items(UUID) TO anon, authenticated;
