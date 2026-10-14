import { catalogFetch, readJson } from "../http";
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

function fromBookData(isbn: string, book: OpenLibraryBookData): CatalogItem | null {
  if (!book.title) return null;
  const subjects = book.subjects?.map((s) => s.name).filter(Boolean) as string[] | undefined;
  const comic = looksLikeComic(subjects);
  const isbn13 = book.identifiers?.isbn_13?.[0] || isbn;

  return {
    title: book.title,
    artist_creator: book.authors?.[0]?.name || null,
    category: comic ? "comic" : "book",
    subcategory: comic ? "Komiks" : null,
    cover_url: book.cover?.large || book.cover?.medium || null,
    metadata: {
      year: yearFromDate(book.publish_date),
      publisher: book.publishers?.[0]?.name,
      isbn: isbn13,
      source: "openlibrary",
    },
    source: "openlibrary",
  };
}

function fromSearchDoc(doc: OpenLibrarySearchDoc, categoryHint?: string): CatalogItem | null {
  if (!doc.title) return null;
  const comic = categoryHint === "comic" || looksLikeComic(doc.subject);
  const isbn = doc.isbn?.[0];
  const cover = doc.cover_i
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    : isbn
      ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
      : null;

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
  const doc = json?.docs?.[0];
  if (!doc) return null;
  return fromSearchDoc(doc, categoryHint);
}
