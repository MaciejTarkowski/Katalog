import { catalogFetch, readJson } from "../http";
import { textsOverlap } from "../normalize";
import type { CatalogItem } from "../types";

interface OpenLibraryBookData {
  title?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  cover?: { large?: string; medium?: string; small?: string };
  identifiers?: { isbn_13?: string[]; isbn_10?: string[] };
  subjects?: Array<{ name?: string }>;
}

interface OpenLibrarySearchDoc {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  publisher?: string[];
  subject?: string[];
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibrarySearchDoc[];
}

function yearFromDate(value?: string | number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const match = String(value).match(/\d{4}/);
  return match?.[0];
}

function looksLikeComic(subjects: string[] | undefined): boolean {
  if (!subjects?.length) return false;
  const blob = subjects.join(" ").toLowerCase();
  return /comic|komiks|manga|graphic novel|bande dessin/.test(blob);
}

/** Without `default=false` Open Library serves a blank 1x1 image for unknown ISBNs. */
async function isbnCoverUrl(isbn: string | undefined): Promise<string | null> {
  if (!isbn) return null;
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  try {
    const res = await catalogFetch(url, { method: "HEAD" });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

async function fromBookData(isbn: string, book: OpenLibraryBookData): Promise<CatalogItem | null> {
  if (!book.title) return null;
  const subjects = book.subjects?.map((s) => s.name).filter(Boolean) as string[] | undefined;
  const comic = looksLikeComic(subjects);
  const isbn13 = book.identifiers?.isbn_13?.[0] || isbn;

  return {
    title: book.title,
    artist_creator: book.authors?.[0]?.name || null,
    category: comic ? "comic" : "book",
    subcategory: comic ? "Komiks" : null,
    cover_url: book.cover?.large || book.cover?.medium || (await isbnCoverUrl(isbn13)),
    metadata: {
      year: yearFromDate(book.publish_date),
      publisher: book.publishers?.[0]?.name,
      isbn: isbn13,
      source: "openlibrary",
    },
    source: "openlibrary",
  };
}

async function fromSearchDoc(
  doc: OpenLibrarySearchDoc,
  coverId: number | undefined,
  categoryHint?: string
): Promise<CatalogItem | null> {
  if (!doc.title) return null;
  const comic = categoryHint === "comic" || looksLikeComic(doc.subject);
  const isbn = doc.isbn?.[0];
  const cover = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    : await isbnCoverUrl(isbn);

  return {
    title: doc.title,
    artist_creator: doc.author_name?.[0] || null,
    category: comic ? "comic" : "book",
    subcategory: comic ? "Komiks" : null,
    cover_url: cover,
    metadata: {
      year: yearFromDate(doc.first_publish_year),
      publisher: doc.publisher?.[0],
      isbn,
      source: "openlibrary",
    },
    source: "openlibrary",
  };
}

export async function lookupOpenLibraryByIsbn(isbn: string): Promise<CatalogItem | null> {
  const key = `ISBN:${isbn}`;
  const url = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(key)}&format=json&jscmd=data`;
  const json = await readJson<Record<string, OpenLibraryBookData>>(await catalogFetch(url));
  if (!json) return null;
  const book = json[key] || Object.values(json)[0];
  if (!book) return null;
  return fromBookData(isbn, book);
}

export async function searchOpenLibrary(
  query: string,
  categoryHint?: string
): Promise<CatalogItem | null> {
  const params = new URLSearchParams({
    q: query,
    limit: "5",
  });
  if (categoryHint === "comic") {
    params.set("subject", "comics");
  }

  const json = await readJson<OpenLibrarySearchResponse>(
    await catalogFetch(`https://openlibrary.org/search.json?${params.toString()}`)
  );
  const docs = json?.docs ?? [];
  const doc = docs[0];
  if (!doc) return null;
  // The top hit often lacks a cover while another edition of the same title has one.
  const coverId =
    doc.cover_i ??
    docs.find((d) => d.cover_i && d.title && doc.title && textsOverlap(d.title, doc.title))?.cover_i;
  return fromSearchDoc(doc, coverId, categoryHint);
}

/** Up to `limit` distinct search hits (the single-result search keeps only the first). */
export async function searchOpenLibraryMany(query: string, limit = 5): Promise<CatalogItem[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const json = await readJson<OpenLibrarySearchResponse>(
    await catalogFetch(`https://openlibrary.org/search.json?${params.toString()}`)
  );
  const items = await Promise.all((json?.docs ?? []).map((doc) => fromSearchDoc(doc, doc.cover_i)));
  return items.filter((item): item is CatalogItem => Boolean(item));
}
