-- Usuwanie konta przez użytkownika (wymóg Google Play). Uruchom raz w Supabase SQL Editor.

-- 9. Usunięcie własnego konta: kasuje użytkownika w auth.users, a razem z nim (ON DELETE CASCADE)
-- profil, wszystkie pozycje i licznik limitów. Pliki okładek usuwa wcześniej klient (Storage API).
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'not signed in';
    END IF;
    DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
