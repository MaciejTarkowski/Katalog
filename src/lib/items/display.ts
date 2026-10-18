import type { CSSProperties } from "react";
import type { Item } from "@/types/database";

export interface CategoryDef {
  value: string;
  /** Plural label used for tabs and rows. */
  label: string;
  /** Singular label used on pills. */
  one: string;
  /** Text colour of the category pill. */
  color: string;
  /** "r,g,b" used for the pill background/border. */
  rgb: string;
}

export const CATEGORIES: CategoryDef[] = [
  { value: "book", label: "Książki", one: "Książka", color: "#fbbf24", rgb: "245,158,11" },
  { value: "music", label: "Muzyka", one: "Muzyka", color: "#c084fc", rgb: "168,85,247" },
  { value: "game", label: "Gry", one: "Gra", color: "#34d399", rgb: "16,185,129" },
  { value: "comic", label: "Komiksy", one: "Komiks", color: "#38bdf8", rgb: "14,165,233" },
];

export const OTHER_CATEGORY: CategoryDef = {
  value: "other",
  label: "Inne",
  one: "Inne",
  color: "#94a3b8",
  rgb: "148,163,184",
};

export function categoryDef(value: string): CategoryDef {
  return CATEGORIES.find((c) => c.value === value) ?? { ...OTHER_CATEGORY, one: value === "other" ? "Inne" : value };
}

/** Categories the user keeps in the catalog (all of them until they choose), in the app's order. */
export function visibleCategories(types: string[] | null | undefined): CategoryDef[] {
  return types ? CATEGORIES.filter((c) => types.includes(c.value)) : CATEGORIES;
}

/** Hides items of categories the user no longer keeps; uncategorised ("other") items always stay. */
export function filterByTypes<T extends Pick<Item, "category">>(items: T[], types: string[] | null | undefined): T[] {
  if (!types) return items;
  return items.filter((i) => types.includes(i.category) || !CATEGORIES.some((c) => c.value === i.category));
}

export function pillStyle(category: string): CSSProperties {
  const c = categoryDef(category);
  return { color: c.color, background: `rgba(${c.rgb},.18)`, borderColor: `rgba(${c.rgb},.3)` };
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic gradient shown behind/instead of a cover. */
export function tileBackground(seed: string): string {
  const hue = hash(seed) % 360;
  return `linear-gradient(155deg, oklch(0.46 0.13 ${hue}), oklch(0.2 0.06 ${hue}))`;
}

export function initialOf(title: string): string {
  return title.trim().charAt(0).toUpperCase();
}

/** Polish plural: forms = [1, 2-4, 5+], e.g. ["pozycja", "pozycje", "pozycji"]. */
export function plural(n: number, forms: [string, string, string]): string {
  if (n === 1) return forms[0];
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? forms[1] : forms[2];
}

/** Lowercase, without diacritics (incl. Polish "ł", which NFD does not decompose). */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

export function matchesQuery(item: Pick<Item, "title" | "artist_creator">, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return normalizeForSearch(`${item.title} ${item.artist_creator ?? ""}`).includes(normalizedQuery);
}

/** "dziś", "wczoraj", "3 dni temu", "tydzień temu", ... */
export function addedAgo(createdAt: string, now: Date = new Date()): string {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(new Date(createdAt))) / 86_400_000);
  if (days <= 0) return "dziś";
  if (days === 1) return "wczoraj";
  if (days < 7) return `${days} dni temu`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "tydzień temu";
  if (days < 31) return `${weeks} ${plural(weeks, ["tydzień", "tygodnie", "tygodni"])} temu`;
  return new Date(createdAt).toLocaleDateString("pl-PL");
}

/** "Książka · twarda oprawa" */
export function metaLine(category: string, subcategory?: string | null): string {
  const one = categoryDef(category).one;
  return subcategory ? `${one} · ${subcategory}` : one;
}

export function collectionSummary(items: Pick<Item, "category">[]): string {
  const total = items.length;
  const cats = new Set(items.map((i) => i.category)).size;
  return `${total} ${plural(total, ["pozycja", "pozycje", "pozycji"])} · ${cats} ${plural(cats, ["kategoria", "kategorie", "kategorii"])}`;
}
