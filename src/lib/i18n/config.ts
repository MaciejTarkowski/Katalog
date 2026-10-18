/** Supported UI languages. To add one: a code here, a name below and a messages file in ./messages. */
export const LOCALES = ["en", "pl", "de"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Each language's own name, shown in the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  pl: "Polski",
  de: "Deutsch",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Request header carrying the UI language to the API routes. */
export const LOCALE_HEADER = "x-locale";
