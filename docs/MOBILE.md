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

Logowanie Google działa w TWA (Chrome Custom Tab). W Supabase dodaj do Redirect URLs adres aplikacji + `/auth/callback`
(pełna konfiguracja: [docs/GOOGLE_AUTH.md](./GOOGLE_AUTH.md)).

### Rozwiązywanie problemów: APK otwiera się "w Chrome" (pasek adresu, komunikat o przeglądarce)
To Chrome zgłasza, że nie potwierdził Digital Asset Links między APK a domeną — sprawdź po kolei:
1. **Adres publiczny.** APK musi wskazywać na publiczny adres produkcyjny (patrz wyżej), nie na chroniony
   Deployment Protection adres podglądu — ten drugi przekierowuje `/.well-known/assetlinks.json` na stronę
   logowania Vercel, więc weryfikacja zawsze zawiedzie.
2. **Zgodność `sha256_cert_fingerprints`.** Fingerprint w `public/.well-known/assetlinks.json` musi być
   odciskiem SHA-256 certyfikatu, którym **faktycznie podpisano instalowany `.apk`** (z PWABuilder → `signing.keystore`
   z kroku 2, albo z Google Play App Signing, jeśli publikujesz przez Play). Nowy keystore = nowy fingerprint =
   trzeba zaktualizować plik i wdrożyć ponownie.
3. **Plik faktycznie wdrożony.** Sprawdź `https://<publiczny-adres>/.well-known/assetlinks.json` w przeglądarce —
   musi zwracać JSON (status 200), nie 404 ani przekierowanie.
4. **Sprawdzarka Google.** `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://<publiczny-adres>&relation=delegate_permission/common.handle_all_urls` — jeśli zwraca pustą listę, weryfikacja nie przechodzi (błąd w 2 lub 3).
5. Po poprawce odinstaluj i zainstaluj APK ponownie — Chrome cache'uje wynik weryfikacji.

## Ograniczenia
- Ikona `maskable` jest tą samą grafiką co `any`; na Androidzie może być przycięta — warto dodać wersję z marginesem ~10%.
- iOS: PWA wymaga Safari i ręcznego dodania do ekranu głównego; nie ma jej w App Store (to wymaga płatnego konta Apple).
