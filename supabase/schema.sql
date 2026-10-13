-- ==============================================================================
-- Schema: Katalog - Items Table
-- Baza danych: PostgreSQL (Supabase)
-- ==============================================================================

-- 1. Utworzenie tabeli items
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist_creator TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    cover_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Komentarze dokumentujące strukturę
COMMENT ON TABLE public.items IS 'Główna tabela katalogu kolekcji użytkownika (książki, płyty, gry itp.)';
COMMENT ON COLUMN public.items.id IS 'Unikalny identyfikator przedmiotu (UUID v4)';
COMMENT ON COLUMN public.items.user_id IS 'ID użytkownika powiązane z auth.users w Supabase';
COMMENT ON COLUMN public.items.title IS 'Tytuł przedmiotu (np. tytuł książki, albumu, gry)';
COMMENT ON COLUMN public.items.artist_creator IS 'Twórca/Autor/Wykonawca/Studio';
COMMENT ON COLUMN public.items.category IS 'Kategoria główna (np. book, music, game, comic)';
COMMENT ON COLUMN public.items.subcategory IS 'Podkategoria (np. vinyl, cd, rpg, manga)';
COMMENT ON COLUMN public.items.cover_url IS 'Adres URL okładki w Supabase Storage lub zewnętrznym CDN';
COMMENT ON COLUMN public.items.metadata IS 'Elastyczne metadane specyficzne dla danej kategorii (np. ISBN, rok wydania, wydawca, platforma) zasilane przez Gemini AI';

-- 3. Indeksy wydajnościowe dla zapytań mobilnych
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items (user_id);
CREATE INDEX IF NOT EXISTS idx_items_user_category ON public.items (user_id, category);
CREATE INDEX IF NOT EXISTS idx_items_metadata_gin ON public.items USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON public.items (created_at DESC);

-- 4. Zabezpieczenie Row Level Security (RLS)
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Polityki RLS: Każdy może przeglądać kolekcje (publiczny odczyt), ale modyfikować może wyłącznie właściciel
CREATE POLICY "Anyone can view public items"
    ON public.items
    FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own items"
    ON public.items
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
    ON public.items
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own items"
    ON public.items
    FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Trigger automatycznej aktualizacji pola updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_items_updated_at
    BEFORE UPDATE ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Konfiguracja Supabase Storage dla okładek (bucket 'covers')
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Publiczny odczyt okładek
CREATE POLICY "Public read covers"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'covers');

-- Logowani użytkownicy mogą dodawać okładki
CREATE POLICY "Authenticated users can upload covers"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');

-- Właściciel może usuwać swoje pliki
CREATE POLICY "Users can delete own covers"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
