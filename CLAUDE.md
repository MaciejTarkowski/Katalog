# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Zasady pracy
- Czytaj tylko pliki potrzebne do zadania. Nie skanuj całego repo bez potrzeby.
- Nie czytaj: node_modules, dist, build, .next, plików lock, .env.
- Jeden błąd naraz: test odtwarzający błąd → poprawka → uruchomienie testów → commit.
- Po każdej poprawce uruchom testy. Nie kończ zadania, dopóki testy nie przechodzą.
- Odpowiadaj krótko: co zmieniłeś i wynik testów. Bez streszczania kodu.
- W razie wątpliwości ZATRZYMAJ SIĘ i zapytaj mnie, podając dwie opcje
  (A i B) z krótkimi plusami/minusami oraz swoją rekomendacją.
- Tylko darmowe rozwiązania i biblioteki. Nie zmieniaj wyglądu aplikacji bez pytania.
- W testach zawsze mockuj API rozpoznawania obrazów (oszczędność limitów).

## Compact instructions
Przy kompaktowaniu zachowaj: listę naprawionych/otwartych błędów, wyniki testów, zmienione pliki.

## Commands

```bash
npm run dev      # Next.js dev server (Turbopack)
npm run build
npm run lint
npm test         # vitest run (jsdom, globals)
npx vitest run src/lib/catalog/__tests__/lookup.test.ts   # one file
npx vitest run -t "test name"                             # one test
```

Tests live in `__tests__/` next to the code. Alias `@/` → `src/`.

## Stack

- Next.js 16.4 / React 19.3, `cacheComponents` + `partialPrefetching` on. Check `node_modules/next/dist/docs/` before using Next APIs from memory. Route `params` are Promises; dynamic pages use `<Suspense>`.
- Tailwind v4 (`@tailwindcss/turbopack`). `tesseract.js` and `html5-qrcode` run client-side only.
- UI text and API errors are in Polish.

## Architecture

Mobile-first PWA for cataloguing a collection (books, music, games, comics). Supabase + one API route.

Add-item flow:
1. `components/items/CoverScanner.tsx` compresses the photo (`lib/image/compress.ts`), tries a barcode (`lib/scan/barcode.ts`), then Gemini vision via POST `{ image }` to `app/api/catalog/recognize/route.ts` (`lib/recognize/gemini.ts`: retry on 503/429, then next model from `GEMINI_MODELS`), then local OCR (`lib/scan/ocr.ts`), then the manual search field.
2. OCR/barcode path: POST `{ ean?, query?, category? }` to `app/api/catalog/lookup/route.ts`. The recognize route calls the same lookup and merges it with `lib/recognize/merge.ts` (title/category from Gemini, cover/metadata from a catalog hit with a matching title).
3. `lib/catalog/lookup.ts` queries providers in `lib/catalog/providers/` (Open Library, MusicBrainz, Discogs, RAWG) in parallel and picks the most complete result. Order: EAN → EAN extracted from OCR text → free-text search. HTTP goes through `catalogFetch` (`lib/catalog/http.ts`).
4. `AddItemForm` saves via `lib/items/api.ts`; covers go to the Storage bucket `covers` (`lib/storage/upload.ts`).

The only AI call is Gemini in `lib/recognize/gemini.ts` (REST, no SDK) — always mock `fetch` for it in tests.

Supabase:
- `lib/supabase/client.ts` (browser) / `server.ts` (cookies); both fall back to placeholder credentials.
- `lib/items/api.ts` runs client-side and returns `{ data, error }` instead of throwing.
- `supabase/schema.sql` is the source of truth: `items` table (`metadata` JSONB) and `profiles` (`display_name`, created on signup by the `handle_new_user` trigger), both with public read (used by `/share/[userId]`) and owner-only writes, `covers` bucket expecting `<userId>/` folders. `src/types/database.ts` mirrors it by hand.

PWA: `public/manifest.json` + `public/sw.js`, registered by `PwaRegister.tsx` in production only.

## Environment

`.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `GEMINI_API_KEY` (without it scanning skips straight to OCR); optional `GEMINI_MODELS` (comma list, default `gemini-3.8-flash,gemini-3.5-flash,gemini-3.5-flash-lite`). Optional: `RAWG_API_KEY` (no game search without it), `DISCOGS_TOKEN` (works without, lower rate limits), `IGDB_CLIENT_ID` + `IGDB_CLIENT_SECRET` (Twitch app credentials; game covers — without them games have no cover).

`BUGS.MD` — the user's list of open bugs.
