import { describe, it, expect } from "vitest";
import { translator } from "@/lib/i18n/translate";
import { en as messages } from "@/lib/i18n/messages/en";
import { TERM_CODES, canonicalTerm, displayTerm, termCode } from "../terms";

const en = translator("en");
const pl = translator("pl");
const de = translator("de");

describe("terms", () => {
  it("recognizes a format or genre written in any supported language", () => {
    for (const value of ["Winyl", "vinyl", "Vinyl", " Schallplatte ", "płyta winylowa"]) {
      expect(termCode(value), value).toBe("vinyl");
    }
    expect(termCode("Kaseta")).toBe("cassette");
    expect(termCode("Komiks")).toBe("comic");
    expect(termCode("Album")).toBe("album");
    expect(termCode("Action")).toBe("action");
  });

  it("stores known values as codes and keeps platforms and free text as written", () => {
    expect(canonicalTerm("Winyl")).toBe("vinyl");
    expect(canonicalTerm("PS5")).toBe("PS5");
    expect(canonicalTerm("  Fantasy epicka ")).toBe("Fantasy epicka");
    expect(canonicalTerm("   ")).toBeNull();
    expect(canonicalTerm(null)).toBeNull();
  });

  it("shows a known value in the UI language, whatever language it was saved in", () => {
    expect(displayTerm("Winyl", en)).toBe("Vinyl");
    expect(displayTerm("vinyl", pl)).toBe("Winyl");
    expect(displayTerm("Vinyl", de)).toBe("Schallplatte");
    expect(displayTerm("Komiks", en)).toBe("Comic");
    expect(displayTerm("Single", pl)).toBe("Singiel");
    expect(displayTerm("Adventure", pl)).toBe("Przygodowa");
  });

  it("has a translation for every code", () => {
    for (const code of TERM_CODES) expect(Object.keys(messages), code).toContain(`term.${code}`);
  });

  it("leaves platforms and unknown text untouched", () => {
    expect(displayTerm("PS5", pl)).toBe("PS5");
    expect(displayTerm("Xbox One", de)).toBe("Xbox One");
    expect(displayTerm("Fantasy epicka", en)).toBe("Fantasy epicka");
  });
});

describe("subcategory codes migration", () => {
  it("maps every value it changes to the code the app uses", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(__dirname, "../../../../supabase/migrations");
    const file = readdirSync(dir).find((f) => f.includes("items_subcategory_codes"));
    expect(file).toBeDefined();
    const sql = readFileSync(join(dir, file!), "utf-8");
    const pairs = [...sql.matchAll(/WHEN '([^']+)' THEN '([^']+)'/g)];
    expect(pairs.length).toBeGreaterThan(10);
    for (const [, from, to] of pairs) expect(termCode(from), from).toBe(to);
  });
});
