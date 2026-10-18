import { describe, it, expect } from "vitest";
import { addedAgo, collectionSummary, filterByTypes, matchesQuery, visibleCategories, metaLine, normalizeForSearch, plural, tileBackground } from "../display";

describe("display helpers", () => {
  it("picks Polish plural forms", () => {
    const f: [string, string, string] = ["pozycja", "pozycje", "pozycji"];
    expect(plural(1, f)).toBe("pozycja");
    expect(plural(3, f)).toBe("pozycje");
    expect(plural(5, f)).toBe("pozycji");
    expect(plural(12, f)).toBe("pozycji");
    expect(plural(22, f)).toBe("pozycje");
  });

  it("matches titles and creators without diacritics", () => {
    expect(normalizeForSearch("Łódź Żółć")).toBe("lodz zolc");
    expect(matchesQuery({ title: "Solaris", artist_creator: "Stanisław Lem" }, "stanislaw")).toBe(true);
    expect(matchesQuery({ title: "Solaris", artist_creator: null }, "lem")).toBe(false);
  });

  it("describes when an item was added", () => {
    const now = new Date(2026, 9, 15, 12);
    expect(addedAgo(new Date(2026, 9, 15, 8).toISOString(), now)).toBe("dziś");
    expect(addedAgo(new Date(2026, 9, 14, 23).toISOString(), now)).toBe("wczoraj");
    expect(addedAgo(new Date(2026, 9, 11).toISOString(), now)).toBe("4 dni temu");
    expect(addedAgo(new Date(2026, 9, 8).toISOString(), now)).toBe("tydzień temu");
    expect(addedAgo(new Date(2026, 8, 30).toISOString(), now)).toBe("2 tygodnie temu");
  });

  it("formats category lines and collection summary", () => {
    expect(metaLine("game", "PS5")).toBe("Gra · PS5");
    expect(metaLine("music")).toBe("Muzyka");
    expect(collectionSummary([{ category: "book" }, { category: "book" }, { category: "music" }])).toBe(
      "3 pozycje · 2 kategorie"
    );
  });

  it("gives a stable tile gradient per seed", () => {
    expect(tileBackground("abc")).toBe(tileBackground("abc"));
    expect(tileBackground("abc")).toMatch(/^linear-gradient\(155deg, oklch/);
  });
});

describe("collection types", () => {
  const items = ["book", "music", "game", "other"].map((category) => ({ id: category, category }));

  it("shows every category until the user has chosen", () => {
    expect(visibleCategories(null).map((c) => c.value)).toEqual(["book", "music", "game", "comic"]);
    expect(filterByTypes(items, null)).toEqual(items);
  });

  it("keeps only the chosen categories, in the app's order", () => {
    expect(visibleCategories(["game", "book"]).map((c) => c.value)).toEqual(["book", "game"]);
  });

  it("hides items of unchosen categories but keeps uncategorised ones", () => {
    expect(filterByTypes(items, ["game"]).map((i) => i.id)).toEqual(["game", "other"]);
  });
});
