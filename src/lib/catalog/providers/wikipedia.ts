import { catalogFetch, readJson } from "../http";
import { normalizeForMatch } from "../normalize";

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

/** Words (normalized, no diacritics) saying what an article is about, per category. */
const KIND: Record<string, RegExp> = {
  game: /\bgr[aey]\b|\bgier\b/,
  music: /\balbum|\bsingl|\bplyt|\bep\b/,
  book: /\bpowiesc|\bksiazk|\bcykl|\bzbior|\bopowiad|\bpowiesci/,
  comic: /\bkomiks|\bmang|\bseri/,
};

function splitTitle(title: string): { base: string; note: string | null } {
  const match = title.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return match ? { base: match[1], note: match[2] } : { base: title, note: null };
}

function aboutKind(text: string, category?: string): boolean {
  const kind = category ? KIND[category] : undefined;
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

function isMatch(page: WikipediaPage, query: DescriptionQuery): boolean {
  if (!page.title || !page.extract || page.pageprops?.disambiguation !== undefined) return false;
  const { base, note } = splitTitle(page.title);
  if (normalizeForMatch(base) !== normalizeForMatch(query.title)) return false;
  // "Diuna (film 2021)" is not the book: a disambiguation note must name the right kind.
  if (note && !aboutKind(note, query.category)) return false;
  return query.creator ? mentionsCreator(page.extract, query.creator) : aboutKind(page.extract, query.category);
}

/** Short Polish description from the intro of the matching Polish Wikipedia article. */
export async function findWikipediaDescription(query: DescriptionQuery): Promise<WikipediaDescription | null> {
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

  try {
    const json = await readJson<{ query?: { pages?: WikipediaPage[] } }>(
      await catalogFetch(`https://pl.wikipedia.org/w/api.php?${params.toString()}`)
    );
    const pages = [...(json?.query?.pages ?? [])].sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
    const matches = pages.filter((page) => isMatch(page, query));
    // An article marked as the right kind ("… (powieść)") beats a bare title.
    const page = matches.find((p) => splitTitle(p.title!).note) ?? matches[0];
    if (!page) return null;
    return {
      description: shorten(page.extract!.trim()),
      url: `https://pl.wikipedia.org/wiki/${encodeURIComponent(page.title!.replace(/ /g, "_"))}`,
    };
  } catch {
    return null;
  }
}
