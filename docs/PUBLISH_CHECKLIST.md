# Lista kontrolna: publikacja Katalogu w Google Play

Kolejność ma znaczenie: najpierw baza i hosting, potem logowanie, na końcu paczka Android i Play Console.
Punkty oznaczone **(sprawdź)** zależą od aktualnych zasad Google i dostawców API — zweryfikuj je w ich panelach,
bo zmieniają się częściej niż ta lista.

Powiązane dokumenty: [MOBILE.md](./MOBILE.md) (APK/TWA), [GOOGLE_AUTH.md](./GOOGLE_AUTH.md) (logowanie Google), [APPLE_AUTH.md](./APPLE_AUTH.md).

---

## 0. Decyzje przed startem
- [ ] **Własna domena** (np. `katalog.twojadomena.pl`) zamiast `*.vercel.app`. Adres trafia do paczki Android,
      do `assetlinks.json`, do polityki prywatności i do Google OAuth — zmiana później jest bolesna.
- [ ] **Nazwa pakietu Androida** (np. `pl.twojadomena.katalog`). Jest **na stałe** po pierwszym wydaniu.
      Teraz w `public/.well-known/assetlinks.json` jest `app.vercel.katalog_theta_ecru.twa` — to nazwa tymczasowa.
- [ ] Nazwa aplikacji w sklepie i ikona (512×512).
- [ ] Wiek użytkowników: polityka prywatności zakłada **16+**. Jeśli zmienisz, zmień też `src/lib/legal/content.ts`.

## 1. Supabase
- [ ] Uruchom w **SQL Editor**, w tej kolejności, każdą raz (są idempotentne):
  1. `supabase/migrations/20261019_private_collections.sql` — kolekcje prywatne + udostępnianie przez RPC
  2. `supabase/migrations/20261019_covers_upload_own_folder.sql` — upload okładek tylko do własnego folderu
  3. `supabase/migrations/20261019_api_quota.sql` — logowanie i limity na trasach API
  4. `supabase/migrations/20261019_delete_account.sql` — usuwanie konta
  
  Bez 3. skanowanie i wyszukiwanie zwracają błąd 503, bez 4. przycisk „Usuń konto” pokazuje błąd.
- [ ] **Test prywatności** (na produkcji, z kluczem anon z `.env`):
  `curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/items?select=id" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"` → ma zwrócić `[]`.
  Tak samo `/rest/v1/profiles`.
- [ ] **Authentication → URL Configuration**: *Site URL* = adres produkcyjny; *Redirect URLs* = `https://<domena>/auth/callback`
      (i `http://localhost:3000/auth/callback` do pracy lokalnej).
- [ ] **Authentication → Providers → Google**: włączony, Client ID i Secret wklejone ([GOOGLE_AUTH.md](./GOOGLE_AUTH.md)).
      Apple zostaje wyłączone (przycisk ukryty flagą `SHOW_APPLE_LOGIN`).
- [ ] **Własny SMTP** (Authentication → SMTP Settings). Domyślna poczta Supabase ma bardzo niski limit
      wiadomości i nie nadaje się do otwartej rejestracji. Darmowe opcje: konto SMTP u dostawcy domeny albo
      darmowy plan serwisu transakcyjnego **(sprawdź limity)**.
- [ ] **Authentication → Rate Limits / CAPTCHA**: włącz CAPTCHA (np. Cloudflare Turnstile — darmowy) albo przynajmniej
      sprawdź domyślne limity rejestracji i logowania.
- [ ] **Authentication → Emails**: szablony potwierdzenia w języku użytkowników; nadawca z Twojej domeny.
- [ ] **Plan i kopie zapasowe**: darmowy projekt jest usypiany po okresie nieaktywności i nie ma kopii zapasowych
      **(sprawdź)**. Dla prawdziwych użytkowników rozważ plan Pro albo regularny eksport bazy.
- [ ] Storage → bucket `covers` istnieje i jest publiczny do odczytu (tak ma być); upload tylko do własnego folderu.

## 2. Vercel
- [ ] Projekt podpięty do repo, gałąź produkcyjna `main`.
- [ ] **Settings → Environment Variables → Production** (klucze serwerowe **bez** prefiksu `NEXT_PUBLIC_`):

  | Zmienna | Uwagi |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | z Supabase → Project Settings → API |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | klucz `anon` (publiczny, chroni go RLS) |
  | `GEMINI_API_KEY` | bez niego skan idzie od razu do OCR |
  | `RAWG_API_KEY` | bez niego nie ma wyszukiwania gier |
  | `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | bez nich gry nie mają okładek |
  | `DISCOGS_TOKEN` | opcjonalny, wyższe limity |
  | `GEMINI_MODELS` | opcjonalny |

  **Nigdy** nie wpisuj klucza `service_role` — aplikacja go nie używa.
- [ ] **Settings → Deployment Protection**: wyłącz *Vercel Authentication* dla **Production**
      (inaczej `/manifest.json`, `/privacy` i `assetlinks.json` przekierowują na logowanie Vercel — [MOBILE.md](./MOBILE.md)).
- [ ] **Settings → Domains**: dodaj własną domenę (HTTPS automatycznie).
- [ ] **Plan**: Hobby jest tylko do użytku niekomercyjnego **(sprawdź regulamin)**. Przy monetyzacji potrzebny Pro.
- [ ] Po wdrożeniu otwórz w oknie incognito i sprawdź, że działają bez logowania:
  `/`, `/manifest.json`, `/privacy`, `/delete-account`, `/.well-known/assetlinks.json` (musi zwrócić JSON, status 200).
- [ ] `/api/catalog/lookup` bez logowania zwraca **401** (nie 500).

## 3. Google Cloud (logowanie Google)
- [ ] **OAuth consent screen → Publishing status: „In production”**. W trybie *Testing* zalogują się tylko wskazane konta.
      Dla zakresów `openid`, `email`, `profile` weryfikacja Google zwykle nie jest wymagana **(sprawdź)**.
- [ ] Na ekranie zgody: nazwa „Katalog”, e-mail `nerdousai@gmail.com`, logo, **link do polityki prywatności**
      `https://<domena>/privacy`, domena w *Authorized domains*.
- [ ] Credentials → klient OAuth *Web application* → *Authorized redirect URI*: `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] Test: nowe konto Google (nie z listy testerów) loguje się w produkcji.

## 4. Zewnętrzne API
- [ ] **Gemini**: sprawdź limity i **warunki wykorzystania danych w darmowym planie** — zdjęcia okładek użytkowników
      trafiają do Google, a polityka prywatności mówi, że Google przetwarza je na zasadach swojego API
      **(sprawdź)**. Rozważ płatny plan z ustawionym limitem wydatków.
- [ ] **RAWG**: warunki darmowego użycia (w tym wymóg atrybucji) **(sprawdź)**.
- [ ] **IGDB / Twitch**: warunki dla aplikacji publicznej i komercyjnej **(sprawdź)**.
- [ ] **Discogs**: limity i warunki; token ustawiony.
- [ ] **MusicBrainz / Wikipedia**: `User-Agent` ma prawdziwy kontakt (`nerdousai@gmail.com`) — zrobione w kodzie.
- [ ] Limity w aplikacji: 30 rozpoznań zdjęć i 300 zapytań do katalogów na godzinę na użytkownika
      (w funkcji `consume_api_quota`, plik `supabase/schema.sql`). Dopasuj do swoich limitów u dostawców.

## 5. Paczka Android (TWA przez PWABuilder)
Szczegóły: [MOBILE.md](./MOBILE.md).
- [ ] Wdrożony publiczny adres produkcyjny (pkt 2) i PWABuilder pokazuje manifest + service worker na zielono.
- [ ] **Ikona maskable z marginesem ~10%** (`public/icons/`, w manifeście ta sama grafika co `any` jest przycinana na Androidzie).
- [ ] Package ID z pkt 0; `Package for stores → Android`; wygeneruj `.aab`.
- [ ] **Zrób kopię `signing.keystore` i hasła w bezpiecznym miejscu** (np. menedżer haseł + drugi nośnik).
      Bez nich nie wydasz aktualizacji tej samej aplikacji.
- [ ] Włącz **Play App Signing** (domyślne dla nowych aplikacji): Google podpisuje aplikację własnym kluczem.
- [ ] W Play Console → *Setup → App signing* skopiuj **SHA-256 certyfikatu podpisywania aplikacji** i wpisz go
      w `public/.well-known/assetlinks.json` (obok odcisku klucza uploadu, jeśli chcesz testować lokalnie).
      Wdróż i sprawdź adres `https://<domena>/.well-known/assetlinks.json` oraz
      `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://<domena>&relation=delegate_permission/common.handle_all_urls`.
- [ ] Zainstaluj z Play (test wewnętrzny) na prawdziwym telefonie i sprawdź:
  - [ ] aplikacja otwiera się **bez paska adresu** Chrome,
  - [ ] logowanie e-mailem i przez Google działa i wraca do aplikacji,
  - [ ] skan okładki (aparat), wyszukiwanie ręczne, dodanie i usunięcie pozycji,
  - [ ] udostępnianie: włączenie linku, otwarcie go w przeglądarce w trybie incognito, wyłączenie,
  - [ ] **Usuń konto** działa i wraca do ekranu powitalnego,
  - [ ] zakładka „Start” i polskie/angielskie teksty wyglądają poprawnie.

## 6. Play Console
- [ ] Konto deweloperskie: **25 USD jednorazowo** + weryfikacja tożsamości (może potrwać kilka dni).
- [ ] **Nowe konta osobiste** zwykle muszą przed produkcją przejść **zamknięty test z grupą testerów przez kilkanaście dni**
      **(sprawdź aktualne wymagania w Play Console)** — zaplanuj to z wyprzedzeniem i zbierz testerów.
- [ ] Utwórz aplikację (domyślny język, darmowa).
- [ ] **Karta sklepu**: krótki i pełny opis (PL + EN), ikona 512×512, grafika funkcji 1024×500,
      co najmniej 2 zrzuty ekranu telefonu.
- [ ] **Polityka prywatności**: `https://<domena>/privacy`.
- [ ] **Usuwanie konta** (sekcja Data safety → Delete account): usuwanie w aplikacji (Profil → ⋯ → Usuń konto)
      oraz adres `https://<domena>/delete-account`.
- [ ] **Dostęp do aplikacji** (App access): aplikacja wymaga logowania, więc **załóż konto testowe z kilkoma pozycjami**
      i podaj recenzentowi e-mail i hasło (nie konto Google).
- [ ] **Reklamy**: brak. **Kategoria**: np. Narzędzia / Styl życia. **Docelowa grupa wiekowa**: 16+ (zgodnie z polityką).
- [ ] **Ankieta oceny treści** (brak treści wrażliwych, ale aplikacja pokazuje okładki gier i płyt wydawanych przez innych —
      odpowiadaj zgodnie z prawdą).
- [ ] **Formularz Data safety** — propozycja odpowiedzi (zweryfikuj z aktualnym formularzem):

  | Dane | Zbierane? | Cel | Udostępniane stronom trzecim |
  |---|---|---|---|
  | E-mail, imię / nazwa | tak | zarządzanie kontem, funkcje aplikacji | nie (Supabase przetwarza w naszym imieniu) |
  | Zdjęcia (skan okładki) | tak, opcjonalnie | funkcje aplikacji (rozpoznawanie) | przetwarza Google (Gemini) w naszym imieniu |
  | Treści użytkownika (kolekcja, wgrane okładki) | tak | funkcje aplikacji | nie; widoczne publicznie tylko po włączeniu linku |
  | Adres IP (logi serwera) | tak | bezpieczeństwo, działanie | nie |
  | Reklamy, analityka, lokalizacja, kontakty | nie | — | — |

  Dane szyfrowane w transmisji: **tak**. Użytkownik może zażądać usunięcia: **tak**.
- [ ] **Deklaracje**: brak zakupów w aplikacji, brak aplikacji dla dzieci, brak wiadomości/newsów.
- [ ] Wydanie: najpierw **test wewnętrzny** → **zamknięty test** (jeśli wymagany) → **produkcja**.
- [ ] Przed wysłaniem do recenzji ustaw **kraje dystrybucji**.

## 7. Po publikacji
- [ ] **Monitoruj**: logi Vercel (błędy 4xx/5xx w `/api/catalog/*`), użycie Supabase (baza, storage, auth), wydatki u Gemini.
- [ ] **Jeśli zmieniasz politykę prywatności**: zaktualizuj `src/lib/legal/content.ts` (data i treść), formularz Data safety
      i — przy istotnych zmianach — poinformuj użytkowników w aplikacji.
- [ ] **Jeśli dodajesz nowe usługi zewnętrzne** (analityka, nowy dostawca API, logowanie Apple): dopisz je do polityki
      i do formularza Data safety *przed* wdrożeniem.
- [ ] **Aktualizacje aplikacji**: zmiany w kodzie wdrażają się na Vercelu i trafiają do TWA same. Nową paczkę `.aab`
      budujesz tylko przy zmianie ikony, nazwy, uprawnień lub adresu (zwiększ `versionCode`, ten sam keystore).
- [ ] Regularna kopia zapasowa bazy (jeśli plan Supabase jej nie zapewnia).

## 8. Znane ograniczenia (świadomie odłożone)
- Okładki w buckecie `covers` są publiczne pod bezpośrednim, nieodgadywalnym adresem (nie wymagają logowania).
- Logowanie przez Apple ukryte ([APPLE_AUTH.md](./APPLE_AUTH.md)); wymaga konta Apple Developer (99 USD/rok).
  Uwaga: jeśli kiedyś wydasz aplikację w App Store z logowaniem Google, Apple może wymagać też logowania przez Apple (sprawdź aktualne zasady).
- Brak eksportu danych użytkownika (polityka obiecuje go na prośbę mailową).
- Użytkownicy z linkiem `/share` widzą kolekcję bez konta — tylko gdy właściciel włączył udostępnianie.
- Czcionka ikon ładuje się z Google Fonts (ujawnione w polityce); można ją w przyszłości hostować samodzielnie.
