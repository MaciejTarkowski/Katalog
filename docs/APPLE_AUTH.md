# Logowanie przez Apple (Supabase OAuth)

Kod jest gotowy: przycisk „Kontynuuj z Apple” w [src/components/auth/AuthForm.tsx](../src/components/auth/AuthForm.tsx)
wywołuje `supabase.auth.signInWithOAuth({ provider: "apple" })`, a powrót obsługuje
[src/app/auth/callback/route.ts](../src/app/auth/callback/route.ts), tak samo jak przy Google
([docs/GOOGLE_AUTH.md](./GOOGLE_AUTH.md)). Brakuje tylko konfiguracji po stronie Apple i Supabase.

**Koszt:** wymagane jest konto **Apple Developer Program** (99 USD rocznie). Darmowe Apple ID nie wystarczy.
Wszystkie kroki da się wykonać z Windowsa, w przeglądarce. Mac nie jest potrzebny.

## 0. Konto Apple Developer
1. [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/): zapisz się jako osoba
   prywatna (*Individual*). Wymaga Apple ID z włączonym uwierzytelnianiem dwuskładnikowym. Aktywacja trwa od kilku
   godzin do 2 dni.
2. Zanotuj **Team ID**: [developer.apple.com/account](https://developer.apple.com/account) → *Membership details*
   (10 znaków, np. `AB12CD34EF`).

## 1. App ID (identyfikator aplikacji)
1. [Certificates, Identifiers & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list) → **+**.
2. Wybierz **App IDs** → *App* → Continue.
3. *Description*: `Katalog`, *Bundle ID* (Explicit): np. `pl.katalog.app`.
4. W *Capabilities* zaznacz **Sign In with Apple** → Continue → Register.

## 2. Services ID (identyfikator dla logowania w przeglądarce)
To jest **Client ID** dla Supabase.
1. Identifiers → **+** → **Services IDs** → Continue.
2. *Description*: `Katalog Web`, *Identifier*: np. `pl.katalog.web` (musi być inny niż Bundle ID z kroku 1).
   Register.
3. Otwórz utworzony Services ID → zaznacz **Sign In with Apple** → **Configure**:
   - *Primary App ID*: App ID z kroku 1,
   - *Domains and Subdomains*: `<project-ref>.supabase.co` (bez `https://`),
   - *Return URLs*: dokładnie
     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     ```
   `<project-ref>` znajdziesz w Supabase: *Project Settings → General → Reference ID*. To jest endpoint **Supabase**,
   nie adres aplikacji. Apple nie przyjmuje adresów `localhost`, ale nie są tu potrzebne.
4. Next → Done → **Continue → Save**.

## 3. Klucz (.p8)
1. [Keys](https://developer.apple.com/account/resources/authkeys/list) → **+**.
2. *Key Name*: `Katalog Sign in with Apple`, zaznacz **Sign In with Apple** → *Configure* → wybierz App ID z kroku 1 → Save.
3. Continue → Register → **Download**. Plik `AuthKey_<KeyID>.p8` można pobrać **tylko raz**: przechowuj go bezpiecznie
   i **nie wrzucaj do repozytorium**.
4. Zanotuj **Key ID** (10 znaków, widoczny na stronie klucza i w nazwie pliku).

## 4. Sekret dla Supabase (JWT)
Supabase nie przyjmuje pliku `.p8` bezpośrednio, tylko podpisany nim token JWT. Wygeneruj go skryptem z repo
(wymaga tylko Node.js, działa na Windowsie):

```bash
node scripts/apple-client-secret.mjs --team AB12CD34EF --key-id XYZ987XYZ9 --client-id pl.katalog.web --p8 C:/sciezka/AuthKey_XYZ987XYZ9.p8
```

Skrypt wypisze długi ciąg `eyJ...` (to jest sekret) i datę jego wygaśnięcia.

> **Ważne:** Apple pozwala na maksymalnie **6 miesięcy** ważności. Zapisz w kalendarzu przypomnienie na kilka dni
> przed datą wypisaną przez skrypt: wtedy uruchom go ponownie i wklej nowy sekret w Supabase (krok 5.2).
> Po wygaśnięciu logowanie przez Apple przestaje działać.

## 5. Supabase Dashboard
1. **Authentication → Sign In / Providers → Apple** → włącz (*Enable*).
2. *Client IDs*: Services ID z kroku 2 (np. `pl.katalog.web`).
   *Secret Key (for OAuth)*: JWT z kroku 4. Zapisz (*Save*).
3. **Authentication → URL Configuration → Redirect URLs**: te same adresy co dla Google
   (`https://<publiczny-adres-produkcyjny>/auth/callback` i `http://localhost:3000/auth/callback`). Jeśli Google już
   działa, nic tu nie zmieniasz.

## 6. Weryfikacja
Kliknij „Kontynuuj z Apple” na stronie logowania: powinna otworzyć się strona appleid.apple.com, a po zalogowaniu
nastąpi powrót do aplikacji.

### Nazwa profilu i e-mail
- Apple przekazuje imię i nazwisko **tylko przy pierwszym logowaniu** (i tylko jeśli użytkownik je udostępni).
  Jeśli nazwa nie dotrze, aplikacja pokazuje początek adresu e-mail, a własną nazwę można ustawić w zakładce Profil.
- Użytkownik może wybrać **Ukryj mój e-mail**. Wtedy konto dostaje adres `...@privaterelay.appleid.com`. To normalne,
  a logowanie działa tak samo.
- Ten sam adres e-mail użyty raz przez Google, a raz przez Apple Supabase połączy w jedno konto, jeśli oba są
  potwierdzone. Przy ukrytym e-mailu Apple powstanie osobne konto.

### Typowe błędy
| Komunikat | Przyczyna | Gdzie poprawić |
|---|---|---|
| „Provider is not enabled” (w aplikacji) | Krok 5.1 nie wykonany | Supabase → Providers → Apple → Enable |
| `invalid_client` (strona Apple) | Zły Client ID (Bundle ID zamiast Services ID), nieaktualny lub błędny sekret (zły Team ID / Key ID / plik .p8) | Supabase → Providers → Apple, wygeneruj sekret ponownie (krok 4) |
| `invalid_request` / „Invalid redirect_uri” (strona Apple) | Return URL z kroku 2.3 nie zgadza się dokładnie z `https://<project-ref>.supabase.co/auth/v1/callback` | Apple → Services ID → Configure |
| Działało, po ~6 miesiącach przestało | Wygasł sekret JWT | Krok 4 + 5.2 |
| Po zalogowaniu wraca na `/?auth_error=1` | Adres aplikacji nie jest na liście Redirect URLs | Supabase → URL Configuration |
