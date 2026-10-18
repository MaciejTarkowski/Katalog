import { describe, it, expect } from "vitest";
import { CONTACT_EMAIL, DELETE_ACCOUNT, PRIVACY, legalText } from "../content";

const allText = (texts: typeof PRIVACY, locale: "en" | "pl") =>
  JSON.stringify(legalText(texts, locale));

describe("legal content", () => {
  it.each([
    ["privacy", PRIVACY],
    ["delete account", DELETE_ACCOUNT],
  ])("%s: Polish has the same sections and list sizes as English", (_name, texts) => {
    const shape = (locale: "en" | "pl") =>
      legalText(texts, locale).sections.map((s) => [s.items?.length ?? 0, s.paragraphs?.length ?? 0]);
    expect(shape("pl")).toEqual(shape("en"));
  });

  it("falls back to English for a language without its own text", () => {
    expect(legalText(PRIVACY, "de")).toBe(PRIVACY.en);
  });

  it("gives the contact address in both documents and both languages", () => {
    for (const texts of [PRIVACY, DELETE_ACCOUNT]) {
      for (const locale of ["en", "pl"] as const) expect(allText(texts, locale)).toContain(CONTACT_EMAIL);
    }
    expect(CONTACT_EMAIL).toBe("nerdousai@gmail.com");
  });

  it("names every processor the app really sends data to", () => {
    const text = allText(PRIVACY, "en");
    for (const name of ["Supabase", "Vercel", "Gemini", "Open Library", "MusicBrainz", "Discogs", "RAWG", "IGDB", "Wikipedia"]) {
      expect(text).toContain(name);
    }
  });

  it("says how to delete the account in the app, matching the real menu path", () => {
    expect(allText(DELETE_ACCOUNT, "pl")).toContain("Usuń konto");
    expect(allText(DELETE_ACCOUNT, "en")).toContain("Delete account");
  });
});
