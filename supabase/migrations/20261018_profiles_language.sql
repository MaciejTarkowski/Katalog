-- Język interfejsu zapisany w profilu, żeby działał na każdym urządzeniu użytkownika.
-- NULL = nie wybrano, obowiązuje wybór z urządzenia (domyślnie angielski).
-- Przy dodawaniu języka rozszerz listę w CHECK. Uruchom raz w Supabase SQL Editor.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS language TEXT CHECK (language IN ('en', 'pl', 'de'));
