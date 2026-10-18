import { catalogFetch, readJson } from "../http";
import { normalizeForMatch } from "../normalize";
import type { Locale } from "@/lib/i18n/config";

export interface DescriptionQuery {
  title: string;
  creator?: string | null;
  category?: string;
}

export interface WikipediaDescription {
  description: string;
  url: string;
}

interface WikipediaPage {
  title?: string;
  index?: number;
  extract?: string;
  pageprops?: { disambiguation?: string };
}

const MAX_LENGTH = 600;

type Kinds = Record<string, RegExp>;

/** Words (normalized, no diacritics) saying what an article is about, per category. */
const KIND_PL: Kinds = {
  game: /\bgr[aey]\b|\bgier\b/,
  music: /\balbum|\bsingl|\bplyt|\bep\b/,
  book: /\bpowiesc|\bksiazk|\bcykl|\bzbior|\bopowiad|\bpowiesci/,
  comic: /\bkomiks|\bmang|\bseri/,
};

const KIND_EN: Kinds = {
  game: /\bgames?\b/,
  music: /\balbum|\bsingle|\bep\b|\bsong/,
  book: /\bnovel|\bbook|\bcollection|\bstor(y|ies)\b|\bseries/,
  comic: /\bcomic|\bmanga|\bseries/,
};

const KIND_DE: Kinds = {
  game: /\bspiel|\bvideospiel|\bcomputerspiel/,
  music: /\balbum|\bsingle|\bep\b|\blied/,
  book: /\broman|\bbuch|\berzahlung|\bsammlung|\breihe/,
  comic: /\bcomic|\bmanga|\breihe|\bserie/,
};

/** Keywords per UI language; a new language without its own list matches by title and creator only. */
const KINDS: Record<Locale, Kinds> = { pl: KIND_PL, en: KIND_EN, de: KIND_DE };

/** Wikipedia in the UI language first; English only when it has no matching article. */
function wikisFor(locale: Locale): Array<{ host: string; kinds: Kinds }> {
  const langs = locale === "en" ? ["en" as const] : [locale, "en" as const];
  return langs.map((lang) => ({ host: `${lang}.wikipedia.org`, kinds: KINDS[lang] ?? {} }));
}

function splitTitle(title: string): { base: string; note: string | null } {
  const match = title.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return match ? { base: match[1], note: match[2] } : { base: title, note: null };
}

function aboutKind(text: string, kinds: Kinds, category?: string): boolean {
  const kind = category ? kinds[category] : undefined;
  return !kind || kind.test(normalizeForMatch(text));
}

/** Surname-style check: inflected Polish forms ("Franka Herberta") still contain the base word. */
function mentionsCreator(extract: string, creator: string): boolean {
  const text = normalizeForMatch(extract);
  return normalizeForMatch(creator)
    .split(" ")
    .filter((word) => word.length >= 3)
    .some((word) => text.includes(word));
}

function shorten(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  const cut = text.slice(0, MAX_LENGTH);
  const end = cut.lastIndexOf(". ");
  return end > 0 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

function isMatch(page: WikipediaPage, query: DescriptionQuery, kinds: Kinds): boolean {
  if (!page.title || !page.extract || page.pageprops?.disambiguation !== undefined) return false;
  const { base, note } = splitTitle(page.title);
  if (normalizeForMatch(base) !== normalizeForMatch(query.title)) return false;
  // "Diuna (film 2021)" is not the book: a disambiguation note must name the right kind.
  if (note && !aboutKind(note, kinds, query.category)) return false;
  return query.creator ? mentionsCreator(page.extract, query.creator) : aboutKind(page.extract, kinds, query.category);
}

/** Short description from the intro of the matching Wikipedia article: in the UI language, else English. */
export async function findWikipediaDescription(
  query: DescriptionQuery,
  locale: Locale
): Promise<WikipediaDescription | null> {
  try {
    for (const { host, kinds } of wikisFor(locale)) {
      const found = await searchWiki(host, kinds, query);
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  }
}

async function searchWiki(host: string, kinds: Kinds, query: DescriptionQuery): Promise<WikipediaDescription | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: query.title,
    gsrlimit: "6",
    prop: "extracts|pageprops",
    exintro: "1",
    explaintext: "1",
    exsentences: "3",
    exlimit: "max",
    ppprop: "disambiguation",
    redirects: "1",
  });

  const json = await readJson<{ query?: { pages?: WikipediaPage[] } }>(
    await catalogFetch(`https://${host}/w/api.php?${params.toString()}`)
  );
  const pages = [...(json?.query?.pages ?? [])].sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  const matches = pages.filter((page) => isMatch(page, query, kinds));
  // An article marked as the right kind ("… (powieść)") beats a bare title.
  const page = matches.find((p) => splitTitle(p.title!).note) ?? matches[0];
  if (!page) return null;
  return {
    description: shorten(page.extract!.trim()),
    url: `https://${host}/wiki/${encodeURIComponent(page.title!.replace(/ /g, "_"))}`,
  };
}
