const EAN_LENGTHS = new Set([8, 12, 13]);

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Accepts EAN-8, UPC-A (12), EAN-13, and ISBN-10. */
export function normalizeEan(input: string): string | null {
  const digits = digitsOnly(input);
  if (EAN_LENGTHS.has(digits.length)) return digits;
  if (digits.length === 10) return digits;
  return null;
}

export function isIsbnPrefix(ean: string): boolean {
  const digits = digitsOnly(ean);
  return digits.startsWith("978") || digits.startsWith("979") || digits.length === 10;
}

const ISBN_13_RE =
  /\b97[89][-\s]?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,7}[-\s]?\d\b/;
const ISBN_10_RE = /\bISBN(?:-10)?:?\s*(\d{9}[\dXx])\b/i;

export function extractIsbnFromText(text: string): string | null {
  const isbn13 = text.match(ISBN_13_RE);
  if (isbn13) {
    return normalizeEan(isbn13[0]);
  }

  const isbn10 = text.match(ISBN_10_RE);
  if (isbn10?.[1]) {
    return normalizeEan(isbn10[1]);
  }

  return null;
}

export function extractEanFromText(text: string): string | null {
  const clustered = text.match(/\b(\d{8}|\d{12}|\d{13})\b/);
  if (clustered?.[1]) return clustered[1];

  const isbn = extractIsbnFromText(text);
  if (isbn) return isbn;

  const compact = digitsOnly(text);
  if (EAN_LENGTHS.has(compact.length)) return compact;

  return null;
}

export function cleanSearchQuery(text: string): string {
  return text
    .replace(/[|_•·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

/** Lowercase, no diacritics or punctuation — for comparing titles across sources. */
export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when one text contains the other after normalization. */
export function textsOverlap(a: string, b: string): boolean {
  const x = normalizeForMatch(a);
  const y = normalizeForMatch(b);
  return Boolean(x && y) && (x.includes(y) || y.includes(x));
}
