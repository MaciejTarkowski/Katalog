# Katalog na telefonie

Aplikacja potrzebuje serwera (trasy `/api/catalog/*`, Gemini), więc nie da się jej spakować jako statycznej
aplikacji natywnej. Obie platformy używają wdrożonej wersji HTTPS (np. Vercel) jako źródła.

## Wymagany adres produkcyjny
Adres `...-<hash>-<projekt>.vercel.app` to wdrożenie jednorazowe i chronione logowaniem Vercel (Deployment Protection:
każde żądanie, także `/manifest.json`, przekierowuje na vercel.com/sso-api). PWABuilder, APK i linki udostępniania
dla innych osób wymagają **publicznego adresu produkcyjnego**: w Vercel → Settings → Deployment Protection wyłącz
Vercel Authentication dla Production i użyj domeny typu `https://<projekt>.vercel.app` (Settings → Domains).

## iOS — PWA (bez Apple Developer Program)
1. Otwórz wdrożony adres w **Safari** (inne przeglądarki na iOS nie instalują PWA).
2. Udostępnij → **Dodaj do ekranu głównego**.
3. Aplikacja działa w trybie pełnoekranowym (`display: standalone`, ikona i `appleWebApp` są w `layout.tsx`).

## Android — APK (TWA, darmowo)
Wymaga wdrożonego adresu HTTPS.
1. Wejdź na <https://www.pwabuilder.com>, wpisz adres aplikacji — raport powinien pokazać manifest i service worker na zielono.
2. Package for stores → **Android** → wygeneruj paczkę (zachowaj `signing.keystore` i hasło — bez nich nie ma aktualizacji).
3. W paczce jest `assetlinks.json`; skopiuj go do `public/.well-known/assetlinks.json` i wdróż ponownie
   (bez tego aplikacja pokaże pasek adresu Chrome).
4. Zainstaluj `.apk` ręcznie (włącz instalację z nieznanych źródeł). Do Google Play wystarczy `.aab` z tej samej paczki (jednorazowo 25 USD).

Logowanie Google działa w TWA (Chrome Custom Tab). W Supabase dodaj do Redirect URLs adres aplikacji + `/auth/callback`.

## Ograniczenia
- Ikona `maskable` jest tą samą grafiką co `any`; na Androidzie może być przycięta — warto dodać wersję z marginesem ~10%.
- iOS: PWA wymaga Safari i ręcznego dodania do ekranu głównego; nie ma jej w App Store (to wymaga płatnego konta Apple).
