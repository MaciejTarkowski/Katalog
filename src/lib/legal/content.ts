import type { Locale } from "@/lib/i18n/config";

export const CONTACT_EMAIL = "nerdousai@gmail.com";
export const LEGAL_UPDATED = "2026-10-18";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDocument {
  title: string;
  updatedLabel: string;
  sections: LegalSection[];
}

/** Legal pages are written in English and Polish; German (and any new language) shows the English text. */
type Texts = Partial<Record<Locale, LegalDocument>> & { en: LegalDocument };

export function legalText(texts: Texts, locale: Locale): LegalDocument {
  return texts[locale] ?? texts.en;
}

export const PRIVACY: Texts = {
  en: {
    title: "Privacy policy",
    updatedLabel: `Last updated: ${LEGAL_UPDATED}`,
    sections: [
      {
        heading: "Who we are",
        paragraphs: [
          "Katalog is an app for cataloguing personal collections (books, music, games, comics). It is run by an individual developer. For anything about your data, write to " +
            CONTACT_EMAIL +
            ".",
        ],
      },
      {
        heading: "What data we collect",
        items: [
          "Account: your e-mail address and a password (stored only as a hash by our authentication provider), or the name and e-mail from your Google account if you sign in with Google.",
          "Profile: the display name you choose, the language and the item types you keep in your catalog, and whether you turned sharing on.",
          "Your collection: the items you add (title, creator, category, details such as year or platform, description) and the cover images you upload or that the app takes from catalogs.",
          "Photos of covers you scan: used only to recognize the item (see below); they are not stored unless you save the item with the photo as its cover.",
          "Technical data: an hourly counter of how many scans and searches your account made (to protect the service from abuse), and the usual server logs of our hosting provider (IP address, time, requested address).",
        ],
      },
      {
        heading: "How we use it",
        paragraphs: [
          "Only to run the app: to sign you in, to store and show your collection, to recognize covers and find details about them, and to keep the service safe. We do not show ads, do not use analytics or tracking tools, and do not sell your data.",
        ],
      },
      {
        heading: "Who processes it",
        items: [
          "Supabase – authentication, database and storage of covers (your account, collection and uploaded images).",
          "Vercel – hosting of the app and its server functions.",
          "Google (Gemini API) – when you scan a cover with the camera, the photo is sent to Google's Gemini API to recognize the title and creator. Google processes it under the terms of its API; depending on the plan, it may keep it for a limited time.",
          "Google sign-in – only if you choose to sign in with Google.",
          "Public catalogs – to find covers and details, the title or text read from the cover is sent to Open Library, MusicBrainz, Discogs, RAWG, IGDB (Twitch) and Wikipedia. These requests come from our server and do not include your account data.",
        ],
      },
      {
        heading: "Sharing your collection",
        paragraphs: [
          "Your collection is private. It becomes visible to anyone who has the link only after you turn sharing on in the Share tab; the page then shows your display name and your items. You can turn sharing off at any time, and the link stops working immediately. We do not list shared collections anywhere.",
        ],
      },
      {
        heading: "Cookies and local storage",
        paragraphs: [
          "The app uses cookies that keep you signed in, and the browser's local storage for your language and for offline use (a service worker cache). It does not use advertising or analytics cookies.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "Until you delete your account. Deleting the account in the app (Profile → ⋯ → Delete account) immediately removes your account, profile, items and uploaded covers. Copies may remain in our providers' backups for a limited time.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You can see and edit your data in the app, and delete it by deleting your account. You can also ask us to access, correct, export or delete your data, or object to its processing, by writing to " +
            CONTACT_EMAIL +
            ". If you are in the EU/EEA you may also complain to your data protection authority.",
        ],
      },
      {
        heading: "Children",
        paragraphs: ["Katalog is not directed at children under 16, and we do not knowingly collect their data."],
      },
      {
        heading: "Changes",
        paragraphs: ["If we change this policy, we will update the date above. Material changes will be announced in the app."],
      },
    ],
  },
  pl: {
    title: "Polityka prywatności",
    updatedLabel: `Ostatnia aktualizacja: ${LEGAL_UPDATED}`,
    sections: [
      {
        heading: "Kim jesteśmy",
        paragraphs: [
          "Katalog to aplikacja do katalogowania prywatnych kolekcji (książki, muzyka, gry, komiksy). Prowadzi ją indywidualny twórca. W sprawach dotyczących Twoich danych napisz na adres " +
            CONTACT_EMAIL +
            ".",
        ],
      },
      {
        heading: "Jakie dane zbieramy",
        items: [
          "Konto: adres e-mail i hasło (przechowywane wyłącznie w postaci skrótu przez dostawcę uwierzytelniania) albo imię i adres e-mail z konta Google, jeśli logujesz się przez Google.",
          "Profil: wybrana nazwa wyświetlana, język, typy pozycji w katalogu oraz informacja, czy włączono udostępnianie.",
          "Twoja kolekcja: dodane pozycje (tytuł, twórca, kategoria, szczegóły, np. rok lub platforma, opis) oraz okładki, które wgrywasz lub które aplikacja pobiera z katalogów.",
          "Zdjęcia skanowanych okładek: służą wyłącznie do rozpoznania pozycji (patrz niżej); nie są zapisywane, chyba że zapiszesz pozycję ze zdjęciem jako okładką.",
          "Dane techniczne: godzinny licznik skanów i wyszukiwań z Twojego konta (ochrona usługi przed nadużyciami) oraz zwykłe logi serwerowe dostawcy hostingu (adres IP, czas, adres żądania).",
        ],
      },
      {
        heading: "Do czego ich używamy",
        paragraphs: [
          "Wyłącznie do działania aplikacji: logowania, przechowywania i wyświetlania kolekcji, rozpoznawania okładek i szukania informacji o nich oraz zapewnienia bezpieczeństwa usługi. Nie wyświetlamy reklam, nie używamy narzędzi analitycznych ani śledzących i nie sprzedajemy danych.",
        ],
      },
      {
        heading: "Kto je przetwarza",
        items: [
          "Supabase – uwierzytelnianie, baza danych i przechowywanie okładek (konto, kolekcja i wgrane obrazy).",
          "Vercel – hosting aplikacji i jej funkcji serwerowych.",
          "Google (Gemini API) – gdy skanujesz okładkę aparatem, zdjęcie jest wysyłane do Gemini API Google w celu rozpoznania tytułu i twórcy. Google przetwarza je na zasadach swojego API; w zależności od planu może je przez ograniczony czas przechowywać.",
          "Logowanie przez Google – tylko jeśli wybierzesz ten sposób logowania.",
          "Publiczne katalogi – aby znaleźć okładki i szczegóły, tytuł lub tekst odczytany z okładki jest wysyłany do Open Library, MusicBrainz, Discogs, RAWG, IGDB (Twitch) i Wikipedii. Zapytania wysyła nasz serwer i nie zawierają danych Twojego konta.",
        ],
      },
      {
        heading: "Udostępnianie kolekcji",
        paragraphs: [
          "Twoja kolekcja jest prywatna. Staje się widoczna dla każdego, kto ma link, dopiero po włączeniu udostępniania w zakładce Udostępnij; strona pokazuje wtedy Twoją nazwę wyświetlaną i pozycje. Udostępnianie możesz wyłączyć w dowolnej chwili, a link przestaje wtedy działać natychmiast. Nigdzie nie publikujemy listy udostępnionych kolekcji.",
        ],
      },
      {
        heading: "Pliki cookie i pamięć lokalna",
        paragraphs: [
          "Aplikacja używa plików cookie utrzymujących zalogowanie oraz pamięci lokalnej przeglądarki na język i działanie offline (pamięć podręczna service workera). Nie używa reklamowych ani analitycznych plików cookie.",
        ],
      },
      {
        heading: "Jak długo przechowujemy dane",
        paragraphs: [
          "Do usunięcia konta. Usunięcie konta w aplikacji (Profil → ⋯ → Usuń konto) natychmiast usuwa konto, profil, pozycje i wgrane okładki. Kopie mogą przez ograniczony czas pozostać w kopiach zapasowych naszych dostawców.",
        ],
      },
      {
        heading: "Twoje prawa",
        paragraphs: [
          "Dane możesz przeglądać i edytować w aplikacji oraz usunąć, kasując konto. Możesz też poprosić o dostęp do danych, ich sprostowanie, eksport lub usunięcie albo wnieść sprzeciw wobec przetwarzania, pisząc na adres " +
            CONTACT_EMAIL +
            ". W UE/EOG możesz też złożyć skargę do organu ochrony danych (w Polsce: Prezes UODO).",
        ],
      },
      {
        heading: "Dzieci",
        paragraphs: ["Katalog nie jest skierowany do dzieci poniżej 16 lat i świadomie nie zbieramy ich danych."],
      },
      {
        heading: "Zmiany",
        paragraphs: ["Gdy zmienimy tę politykę, zaktualizujemy datę powyżej. O istotnych zmianach poinformujemy w aplikacji."],
      },
    ],
  },
};

export const DELETE_ACCOUNT: Texts = {
  en: {
    title: "Delete your Katalog account",
    updatedLabel: `Last updated: ${LEGAL_UPDATED}`,
    sections: [
      {
        heading: "In the app (instant)",
        items: [
          "Sign in to Katalog.",
          "Open the Profile tab and tap the ⋯ button in the top right corner.",
          "Choose “Delete account” and confirm with “Delete permanently”.",
        ],
        paragraphs: ["Your account is deleted immediately."],
      },
      {
        heading: "What is deleted",
        items: [
          "Your account and sign-in details.",
          "Your profile (display name, language, settings).",
          "All items in your collection.",
          "Cover images you uploaded.",
          "Your shared collection link stops working.",
        ],
        paragraphs: ["Copies may remain in our providers' backups for a limited time. This cannot be undone."],
      },
      {
        heading: "If you cannot use the app",
        paragraphs: [
          "Write to " +
            CONTACT_EMAIL +
            " from the e-mail address of your account, with the subject “Delete my Katalog account”. We will delete the account within 30 days and confirm by e-mail.",
        ],
      },
    ],
  },
  pl: {
    title: "Usuń konto w Katalogu",
    updatedLabel: `Ostatnia aktualizacja: ${LEGAL_UPDATED}`,
    sections: [
      {
        heading: "W aplikacji (natychmiast)",
        items: [
          "Zaloguj się do Katalogu.",
          "Otwórz zakładkę Profil i dotknij przycisku ⋯ w prawym górnym rogu.",
          "Wybierz „Usuń konto” i potwierdź przyciskiem „Usuń na stałe”.",
        ],
        paragraphs: ["Konto zostaje usunięte od razu."],
      },
      {
        heading: "Co zostaje usunięte",
        items: [
          "Konto i dane logowania.",
          "Profil (nazwa wyświetlana, język, ustawienia).",
          "Wszystkie pozycje z Twojej kolekcji.",
          "Wgrane okładki.",
          "Link do udostępnionej kolekcji przestaje działać.",
        ],
        paragraphs: ["Kopie mogą przez ograniczony czas pozostać w kopiach zapasowych naszych dostawców. Tej operacji nie można cofnąć."],
      },
      {
        heading: "Jeśli nie możesz użyć aplikacji",
        paragraphs: [
          "Napisz na adres " +
            CONTACT_EMAIL +
            " z adresu e-mail przypisanego do konta, z tematem „Usuń moje konto w Katalogu”. Usuniemy konto w ciągu 30 dni i potwierdzimy to e-mailem.",
        ],
      },
    ],
  },
};
