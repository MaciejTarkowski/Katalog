import { describe, it, expect } from "vitest";
import { translator } from "@/lib/i18n/translate";
import { addedAgo, collectionSummary, filterByTypes, matchesQuery, visibleCategories, metaLine, normalizeForSearch, tileBackground } from "../display";

const pl = { t: translator("pl"), locale: "pl" as const };
const en = { t: translator("en"), locale: "en" as const };

describe("display helpers", () => {
  it("matches titles and creators without diacritics", () => {
    expect(normalizeForSearch("Łódź Żółć")).toBe("lodz zolc");
    expect(matchesQuery({ title: "Solaris", artist_creator: "Stanisław Lem" }, "stanislaw")).toBe(true);
    expect(matchesQuery({ title: "Solaris", artist_creator: null }, "lem")).toBe(false);
  });

  it("describes when an item was added", () => {
    const now = new Date(2026, 9, 15, 12);
    expect(addedAgo(new Date(2026, 9, 15, 8).toISOString(), pl, now)).toBe("dziś");
    expect(addedAgo(new Date(2026, 9, 14, 23).toISOString(), pl, now)).toBe("wczoraj");
    expect(addedAgo(new Date(2026, 9, 11).toISOString(), pl, now)).toBe("4 dni temu");
    expect(addedAgo(new Date(2026, 9, 8).toISOString(), pl, now)).toBe("tydzień temu");
    expect(addedAgo(new Date(2026, 8, 30).toISOString(), pl, now)).toBe("2 tygodnie temu");
  });

  it("formats category lines and collection summary", () => {
    expect(metaLine("game", "PS5", pl.t)).toBe("Gra · PS5");
    expect(metaLine("music", null, pl.t)).toBe("Muzyka");
    expect(collectionSummary([{ category: "book" }, { category: "book" }, { category: "music" }], pl.t)).toBe(
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
    expect(visibleCategories(null, pl.t).map((c) => c.value)).toEqual(["book", "music", "game", "comic"]);
    expect(filterByTypes(items, null)).toEqual(items);
  });

  it("keeps only the chosen categories, in the app's order", () => {
    expect(visibleCategories(["game", "book"], pl.t).map((c) => c.value)).toEqual(["book", "game"]);
  });

  it("hides items of unchosen categories but keeps uncategorised ones", () => {
    expect(filterByTypes(items, ["game"]).map((i) => i.id)).toEqual(["game", "other"]);
  });
});

describe("display helpers in English", () => {
  it("describes dates, categories and the summary in English", () => {
    const now = new Date(2026, 9, 15, 12);
    expect(addedAgo(new Date(2026, 9, 15, 8).toISOString(), en, now)).toBe("today");
    expect(addedAgo(new Date(2026, 9, 11).toISOString(), en, now)).toBe("4 days ago");
    expect(addedAgo(new Date(2026, 9, 8).toISOString(), en, now)).toBe("a week ago");
    expect(metaLine("game", "PS5", en.t)).toBe("Game · PS5");
    expect(collectionSummary([{ category: "book" }], en.t)).toBe("1 item · 1 category");
    expect(visibleCategories(null, en.t).map((c) => c.label)).toEqual(["Books", "Music", "Games", "Comics"]);
  });
});
