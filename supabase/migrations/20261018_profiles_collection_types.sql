-- Typy pozycji, które użytkownik trzyma w katalogu (wybór przy pierwszym logowaniu,
-- zmiana w profilu). NULL = jeszcze nie wybrano — aplikacja zapyta przy następnym logowaniu.
-- Uruchom raz w Supabase SQL Editor.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS collection_types TEXT[] CHECK (
        collection_types IS NULL
        OR (cardinality(collection_types) > 0 AND collection_types <@ ARRAY['book', 'music', 'game', 'comic'])
    );
