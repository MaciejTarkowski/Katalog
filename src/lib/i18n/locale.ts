import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALE_HEADER, isLocale, type Locale } from "./config";
import { translator, type Translate } from "./translate";

const STORAGE_KEY = "katalog.locale";

function readStored(): Locale {
  try {
    const value = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// Starts as the default, like the server render, so hydration matches; restoreLocale() then
// switches to the language picked on this device.
let current: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

/** The UI language: the one picked on this device (or from the profile), English by default. */
export function getLocale(): Locale {
  return current;
}

function apply(locale: Locale) {
  current = locale;
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  listeners.forEach((listener) => listener());
}

/** Picks a language and remembers it on this device. */
export function setLocale(locale: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Private mode / blocked storage: the choice lasts until the page is reloaded.
  }
  apply(locale);
}

/** After hydration: switch to the language remembered on this device (if any). */
export function restoreLocale() {
  apply(readStored());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current language and a translate function; re-renders when the language changes. */
export function useI18n(): { locale: Locale; t: Translate } {
  const locale = useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
  return { locale, t: translator(locale) };
}

/** Translate outside React (API helpers): uses the current language. */
export function t(...args: Parameters<Translate>): string {
  return translator(getLocale())(...args);
}

/** Headers for our API routes, so their errors and descriptions come in the UI language. */
export function localeHeaders(): Record<string, string> {
  return { [LOCALE_HEADER]: getLocale() };
}
