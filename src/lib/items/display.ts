import type { CSSProperties } from "react";
import type { Item } from "@/types/database";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";

type KnownCategory = "book" | "music" | "game" | "comic";

export interface CategoryStyle {
  value: string;
  /** Text colour of the category pill. */
  color: string;
  /** "r,g,b" used for the pill background/border. */
  rgb: string;
}

export interface CategoryDef extends CategoryStyle {
  /** Plural label used for tabs and rows. */
  label: string;
  /** Singular label used on pills. */
  one: string;
}

/** The app's categories in display order (labels: `localizedCategories`). */
export const CATEGORIES: Array<CategoryStyle & { value: KnownCategory }> = [
  { value: "book", color: "#fbbf24", rgb: "245,158,11" },
  { value: "music", color: "#c084fc", rgb: "168,85,247" },
  { value: "game", color: "#34d399", rgb: "16,185,129" },
  { value: "comic", color: "#38bdf8", rgb: "14,165,233" },
];

const OTHER_STYLE: CategoryStyle = { value: "other", color: "#94a3b8", rgb: "148,163,184" };

export function isKnownCategory(value: string): boolean {
  return CATEGORIES.some((c) => c.value === value);
}

/** Categories with labels in the UI language of `t` (from useI18n). */
export function localizedCategories(t: Translate): CategoryDef[] {
  return CATEGORIES.map((c) => ({ ...c, label: t(`category.${c.value}`), one: t(`category.${c.value}.one`) }));
}

export function otherCategory(t: Translate): CategoryDef {
  return { ...OTHER_STYLE, label: t("category.other"), one: t("category.other") };
}

export function categoryDef(value: string, t: Translate): CategoryDef {
  const known = localizedCategories(t).find((c) => c.value === value);
  if (known) return known;
  // An unknown category keeps its own name.
  return value === "other" ? otherCategory(t) : { ...OTHER_STYLE, label: value, one: value };
}

/** Categories the user keeps in the catalog (all of them until they choose), in the app's order. */
export function visibleCategories(types: string[] | null | undefined, t: Translate): CategoryDef[] {
  const all = localizedCategories(t);
  return types ? all.filter((c) => types.includes(c.value)) : all;
}

/** Hides items of categories the user no longer keeps; uncategorised ("other") items always stay. */
export function filterByTypes<T extends Pick<Item, "category">>(items: T[], types: string[] | null | undefined): T[] {
  if (!types) return items;
  return items.filter((i) => types.includes(i.category) || !isKnownCategory(i.category));
}

export function pillStyle(category: string): CSSProperties {
  const c = CATEGORIES.find((k) => k.value === category) ?? OTHER_STYLE;
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

/** Date in the UI language, e.g. "18.10.2026" in Polish. */
export function formatDate(date: string, locale: Locale): string {
  return new Date(date).toLocaleDateString(locale);
}

/** "today", "yesterday", "3 days ago", "a week ago", ... then the date. */
export function addedAgo(
  createdAt: string,
  { t, locale }: { t: Translate; locale: Locale },
  now: Date = new Date()
): string {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(new Date(createdAt))) / 86_400_000);
  if (days <= 0) return t("ago.today");
  if (days === 1) return t("ago.yesterday");
  if (days < 7) return t("ago.days", { count: days });
  if (days < 31) return t("ago.weeks", { count: Math.floor(days / 7) });
  return formatDate(createdAt, locale);
}

/** Title comparison for A–Z sorting in the UI language. */
export function compareTitles(a: string, b: string, locale: Locale): number {
  return a.localeCompare(b, locale);
}

/** "Book · hardcover" */
export function metaLine(category: string, subcategory: string | null | undefined, t: Translate): string {
  const one = categoryDef(category, t).one;
  return subcategory ? `${one} · ${subcategory}` : one;
}

export function collectionSummary(items: Pick<Item, "category">[], t: Translate): string {
  const total = items.length;
  const cats = new Set(items.map((i) => i.category)).size;
  return `${t("summary.items", { count: total })} · ${t("summary.categories", { count: cats })}`;
}
