-- Użytkownicy logujący się przez Google nie mieli nazwy w profilu: trigger czytał tylko
-- display_name, a Google przekazuje full_name / name. Uruchom raz w Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, left(COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), '')
    ), 50))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Uzupełnij istniejące konta: brakujące profile i puste nazwy.
INSERT INTO public.profiles (id, display_name)
SELECT u.id, left(COALESCE(
    NULLIF(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    NULLIF(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(trim(u.raw_user_meta_data ->> 'name'), '')
), 50)
FROM auth.users u
ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name
    WHERE public.profiles.display_name IS NULL
      AND EXCLUDED.display_name IS NOT NULL;
