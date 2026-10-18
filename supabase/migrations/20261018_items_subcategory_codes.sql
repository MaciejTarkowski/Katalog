-- Znane nośniki / typy wydań w podkategorii zapisywane jako kody (np. "Winyl" → "vinyl"),
-- żeby aplikacja pokazywała je w wybranym języku interfejsu (src/lib/items/terms.ts).
-- Platformy (PS5, PC) i tekst wpisany ręcznie zostają bez zmian. Uruchom raz w Supabase SQL Editor.

UPDATE public.items
SET subcategory = CASE lower(trim(subcategory))
    WHEN 'winyl' THEN 'vinyl'
    WHEN 'vinyl' THEN 'vinyl'
    WHEN 'lp' THEN 'vinyl'
    WHEN 'płyta winylowa' THEN 'vinyl'
    WHEN 'schallplatte' THEN 'vinyl'
    WHEN 'kaseta' THEN 'cassette'
    WHEN 'cassette' THEN 'cassette'
    WHEN 'kassette' THEN 'cassette'
    WHEN 'cd' THEN 'cd'
    WHEN 'płyta cd' THEN 'cd'
    WHEN 'compact disc' THEN 'cd'
    WHEN 'dvd' THEN 'dvd'
    WHEN 'blu-ray' THEN 'bluray'
    WHEN 'file' THEN 'digital'
    WHEN 'box set' THEN 'box_set'
    WHEN 'album' THEN 'album'
    WHEN 'single' THEN 'single'
    WHEN 'singiel' THEN 'single'
    WHEN 'ep' THEN 'ep'
    WHEN 'compilation' THEN 'compilation'
    WHEN 'kompilacja' THEN 'compilation'
    WHEN 'soundtrack' THEN 'soundtrack'
    WHEN 'broadcast' THEN 'broadcast'
    WHEN 'komiks' THEN 'comic'
    WHEN 'comic' THEN 'comic'
    WHEN 'manga' THEN 'manga'
    WHEN 'twarda oprawa' THEN 'hardcover'
    WHEN 'hardcover' THEN 'hardcover'
    WHEN 'miękka oprawa' THEN 'paperback'
    WHEN 'paperback' THEN 'paperback'
    WHEN 'e-book' THEN 'ebook'
    WHEN 'ebook' THEN 'ebook'
    WHEN 'audiobook' THEN 'audiobook'
    ELSE subcategory
END
WHERE subcategory IS NOT NULL;
