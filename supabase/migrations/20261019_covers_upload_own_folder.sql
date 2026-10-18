-- Okładki: wgrywać można tylko do własnego folderu <userId>/ (wcześniej wystarczyło być zalogowanym,
-- więc użytkownik mógł zapisywać pliki w folderach innych osób). Uruchom raz w Supabase SQL Editor.
-- Aplikacja już zapisuje pliki jako <userId>/<plik> (lib/storage/upload.ts).

DROP POLICY IF EXISTS "Authenticated users can upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload covers to own folder" ON storage.objects;
CREATE POLICY "Users can upload covers to own folder"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
