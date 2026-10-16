# Logowanie przez Google (Supabase OAuth)

Kod jest gotowy ([src/components/auth/AuthForm.tsx](../src/components/auth/AuthForm.tsx) wywołuje
`supabase.auth.signInWithOAuth({ provider: "google" })`, powrót obsługuje
[src/app/auth/callback/route.ts](../src/app/auth/callback/route.ts)) — "nie działa" niemal zawsze oznacza brakującą
konfigurację po stronie Google Cloud Console i/lub Supabase, nie błąd w repo.

## 1. Google Cloud Console
1. [console.cloud.google.com](https://console.cloud.google.com) → wybierz lub utwórz projekt.
2. **APIs & Services → OAuth consent screen** → typ *External*, nazwa aplikacji "Katalog", e-mail kontaktowy. Zapisz.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → typ **Web application**.
4. **Authorized redirect URIs** → dodaj dokładnie:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   `<project-ref>` znajdziesz w Supabase: *Project Settings → General → Reference ID*. To jest endpoint **Supabase**,
   nie adres aplikacji `/auth/callback` (ten obsługuje tylko ostatni etap, wymianę kodu na sesję).
5. Zapisz **Client ID** i **Client Secret** wygenerowane po utworzeniu.

## 2. Supabase Dashboard
1. **Authentication → Providers → Google** → włącz (*Enable*).
2. Wklej **Client ID** i **Client Secret** z kroku 1 → *Save*.
3. **Authentication → URL Configuration → Redirect URLs** → dodaj adres(y) aplikacji + `/auth/callback`, np.:
   - `https://<publiczny-adres-produkcyjny>/auth/callback` — musi to być **publiczny** adres, nie chroniony
     Deployment Protection (patrz [docs/MOBILE.md](./MOBILE.md#wymagany-adres-produkcyjny));
   - `http://localhost:3000/auth/callback` — do pracy lokalnej (`npm run dev`);
   - ten sam publiczny adres obsługuje też logowanie w APK/TWA (Chrome Custom Tab).

## 3. Weryfikacja
Kliknij "Kontynuuj z Google" na stronie logowania — powinieneś zobaczyć ekran zgody Google, bez błędu w aplikacji.

### Typowe błędy
| Komunikat | Przyczyna | Gdzie poprawić |
|---|---|---|
| "Provider is not enabled" (w aplikacji, z Supabase) | Krok 2.1 nie wykonany | Supabase → Providers → Google → Enable |
| "redirect_uri_mismatch" (strona Google) | Redirect URI z kroku 1.4 nie zgadza się dokładnie (http/https, literówka w `project-ref`, brak `/auth/v1/callback`) | Google Cloud Console → Credentials |
| Po zgodzie wraca na `/?auth_error=1` | Adres z kroku 2.3 nie jest na liście Redirect URLs w Supabase, albo wymiana kodu zawiodła | Supabase → URL Configuration |
| Działa lokalnie, nie działa po wdrożeniu | Brak publicznego adresu produkcyjnego na liście z kroku 2.3 | Supabase → URL Configuration + [docs/MOBILE.md](./MOBILE.md) |
