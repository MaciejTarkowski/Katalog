-- Limit wywołań API na użytkownika (rozpoznawanie zdjęć, katalogi) + wymóg logowania; używa tego lib/api/guard.ts.
-- Uruchom raz w Supabase SQL Editor PRZED wdrożeniem kodu: bez tej funkcji trasy /api/catalog/* odpowiadają błędem 503.

-- 8. Limit zapytań do płatnych / limitowanych API (Gemini, katalogi) na użytkownika.
-- Tabela jest dostępna wyłącznie przez funkcję poniżej (RLS włączone, bez polityk).
CREATE TABLE IF NOT EXISTS public.api_usage (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    calls INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, bucket, window_start)
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Zlicza jedno wywołanie zalogowanego użytkownika (z JWT, auth.uid()) w bieżącej godzinie.
-- Zwraca: -1 = niezalogowany, 0 = limit wyczerpany, 1 = dozwolone.
-- Limity są tu, a nie w parametrach, żeby klient nie mógł podać własnych.
CREATE OR REPLACE FUNCTION public.consume_api_quota(p_bucket TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    uid UUID := auth.uid();
    max_calls INTEGER;
    win TIMESTAMPTZ;
    used INTEGER;
BEGIN
    IF uid IS NULL THEN
        RETURN -1;
    END IF;

    max_calls := CASE p_bucket
        WHEN 'recognize' THEN 30   -- rozpoznawanie zdjęcia (Gemini)
        WHEN 'catalog' THEN 300    -- wyszukiwanie w katalogach (RAWG, IGDB, Discogs...)
        ELSE NULL
    END;
    IF max_calls IS NULL THEN
        RAISE EXCEPTION 'unknown quota bucket: %', p_bucket;
    END IF;

    win := to_timestamp(floor(extract(epoch FROM now()) / 3600) * 3600);
    DELETE FROM public.api_usage WHERE user_id = uid AND window_start < now() - interval '1 day';

    INSERT INTO public.api_usage AS u (user_id, bucket, window_start, calls)
    VALUES (uid, p_bucket, win, 1)
    ON CONFLICT (user_id, bucket, window_start) DO UPDATE SET calls = u.calls + 1
    RETURNING u.calls INTO used;

    RETURN CASE WHEN used > max_calls THEN 0 ELSE 1 END;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_quota(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_api_quota(TEXT) TO authenticated;
