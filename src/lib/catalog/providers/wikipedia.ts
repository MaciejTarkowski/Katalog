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

/** Polish first; English only when Polish Wikipedia has no matching article. */
const WIKIS: Array<{ host: string; kinds: Kinds }> = [
  { host: "pl.wikipedia.org", kinds: KIND_PL },
  { host: "en.wikipedia.org", kinds: KIND_EN },
];

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

/** Short description from the intro of the matching Wikipedia article: Polish, else English. */
export async function findWikipediaDescription(query: DescriptionQuery): Promise<WikipediaDescription | null> {
  try {
    for (const { host, kinds } of WIKIS) {
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
