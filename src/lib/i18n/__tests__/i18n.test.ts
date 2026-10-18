import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { DEFAULT_LOCALE, LOCALES, isLocale } from "../config";
import { en } from "../messages/en";
import { messagesFor, translate } from "../translate";
import { getLocale, localeHeaders, restoreLocale, setLocale, useI18n } from "../locale";
import { requestLocale } from "../server";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const texts = (value: string | Record<string, string>) => (typeof value === "string" ? [value] : Object.values(value));

describe("messages", () => {
  it("defaults to English", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it.each(LOCALES)("%s defines every key, with the same placeholders as English", (locale) => {
    const messages = messagesFor(locale);
    expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(en)) {
      const expected = placeholders(texts(value).join(" ")).filter((p) => p !== "count");
      for (const text of texts(messages[key as keyof typeof en])) {
        expect(text.trim(), `${locale} ${key}`).not.toBe("");
        for (const name of expected) expect(text, `${locale} ${key}`).toContain(`{${name}}`);
      }
      // A plural message stays plural in every language.
      expect(typeof messages[key as keyof typeof en], `${locale} ${key}`).toBe(typeof value);
    }
  });
});

describe("Polish navigation", () => {
  it("translates the Home tab as Start", () => {
    expect(translate("pl", "nav.home")).toBe("Start");
  });
});

describe("translate", () => {
  it("fills placeholders and picks plural forms per language", () => {
    expect(translate("en", "summary.items", { count: 1 })).toBe("1 item");
    expect(translate("en", "summary.items", { count: 5 })).toBe("5 items");
    expect(translate("pl", "summary.items", { count: 1 })).toBe("1 pozycja");
    expect(translate("pl", "summary.items", { count: 3 })).toBe("3 pozycje");
    expect(translate("pl", "summary.items", { count: 12 })).toBe("12 pozycji");
    expect(translate("pl", "summary.items", { count: 22 })).toBe("22 pozycje");
    expect(translate("de", "summary.items", { count: 2 })).toBe("2 Einträge");
  });
});

describe("current language", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is remembered on the device and re-renders components", () => {
    const { result } = renderHook(() => useI18n());
    act(() => setLocale("de"));
    expect(result.current.locale).toBe("de");
    expect(result.current.t("category.book")).toBe("Bücher");
    expect(localStorage.getItem("katalog.locale")).toBe("de");
    expect(document.documentElement.lang).toBe("de");
    expect(getLocale()).toBe("de");
  });

  it("is sent to the API and read back from the request", () => {
    setLocale("pl");
    const headers = new Headers(localeHeaders());
    expect(requestLocale({ headers })).toBe("pl");
    expect(requestLocale({ headers: new Headers() })).toBe("en");
    expect(requestLocale({ headers: new Headers({ "x-locale": "xx" }) })).toBe("en");
  });

  it("restores the language remembered on the device, English when there is none", () => {
    localStorage.setItem("katalog.locale", "de");
    restoreLocale();
    expect(getLocale()).toBe("de");

    localStorage.clear();
    restoreLocale();
    expect(getLocale()).toBe("en");
    expect(localStorage.getItem("katalog.locale")).toBeNull();
  });

  it("only accepts supported languages", () => {
    expect(isLocale("de")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});
