export interface OcrWord {
  text: string;
  confidence: number;
  height: number;
  /** Line index in reading order, used to rejoin letter-spaced words. */
  line?: number;
  x0?: number;
  x1?: number;
}

export interface CoverText {
  query: string;
  category?: "game";
  subcategory?: string;
}

const MIN_CONFIDENCE = 70;
/** Words much smaller than the largest text (title) are usually labels, ratings, fine print. */
const MIN_RELATIVE_HEIGHT = 0.2;
const MAX_WORDS = 8;
/** Gap between letters of a spaced-out word ("S Z E P T Y") vs. a gap between words. */
const WORD_GAP_FACTOR = 1.8;

/** Typical cover boilerplate that never helps a catalog search. */
const STOP_WORDS = new Set([
  "tylko",
  "playstation",
  "pegi",
  "ps3",
  "ps4",
  "ps5",
  "xbox",
  "gra",
  "graw",
  "polskiej",
  "polska",
  "wersja",
  "wersji",
  "językowej",
]);

const PLATFORMS: Array<[RegExp, string]> = [
  [/^ps5$/i, "PS5"],
  [/^ps4$/i, "PS4"],
  [/^ps3$/i, "PS3"],
  [/^switch$/i, "Nintendo Switch"],
  [/^xbox$/i, "Xbox"],
];

function cleanWord(text: string): string {
  return text.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
}

function isUsefulWord(text: string): boolean {
  if ((text.match(/[\p{L}\d]/gu) || []).length < 2) return false;
  const lower = text.toLowerCase();
  if (lower.startsWith("www") || /\.(info|com|pl|net|org)$/.test(lower)) return false;
  return !STOP_WORDS.has(lower);
}

const isSingleLetter = (w: OcrWord) => /^\p{L}$/u.test(w.text);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Splits a run of single letters into words using the gaps between them, when positions are known. */
function joinLetterRun(run: OcrWord[]): OcrWord[] {
  const gaps = run.slice(1).map((w, i) =>
    w.x0 !== undefined && run[i].x1 !== undefined ? w.x0 - run[i].x1 : NaN
  );
  const known = gaps.filter((g) => !Number.isNaN(g));
  const limit = known.length === gaps.length ? median(known) * WORD_GAP_FACTOR : Infinity;

  const groups: OcrWord[][] = [[run[0]]];
  run.slice(1).forEach((w, i) => {
    if (gaps[i] > limit) groups.push([w]);
    else groups[groups.length - 1].push(w);
  });

  return groups.map((group) => ({
    text: group.map((w) => w.text).join(""),
    confidence: Math.min(...group.map((w) => w.confidence)),
    height: Math.max(...group.map((w) => w.height)),
    line: group[0].line,
  }));
}

/** Rejoins letter-spaced titles ("R E M I G I U S Z") that OCR returns as one-letter words. */
export function mergeSpacedLetters(words: OcrWord[]): OcrWord[] {
  const out: OcrWord[] = [];
  let run: OcrWord[] = [];
  const flush = () => {
    if (run.length >= 3) out.push(...joinLetterRun(run));
    else out.push(...run);
    run = [];
  };

  for (const w of words) {
    const continues = run.length > 0 && run[0].line === w.line;
    if (isSingleLetter(w) && (continues || run.length === 0)) {
      run.push(w);
      continue;
    }
    flush();
    if (isSingleLetter(w)) run.push(w);
    else out.push(w);
  }
  flush();
  return out;
}

/** Turns raw OCR words into a short search query, largest (title) text first. */
export function buildCoverQuery(words: OcrWord[]): string {
  const candidates = mergeSpacedLetters(
    words.filter((w) => w.confidence >= MIN_CONFIDENCE).map((w) => ({ ...w, text: cleanWord(w.text) }))
  ).filter((w) => isUsefulWord(w.text));
  if (!candidates.length) return "";

  const maxHeight = Math.max(...candidates.map((w) => w.height));
  const seen = new Set<string>();

  return candidates
    .filter((w) => w.height >= maxHeight * MIN_RELATIVE_HEIGHT)
    .sort((a, b) => b.height - a.height)
    .filter((w) => {
      const key = w.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_WORDS)
    .map((w) => w.text)
    .join(" ");
}

/** Platform markers ("PS4", "Xbox") are dropped from the query but say it's a game and on what. */
export function detectPlatform(words: OcrWord[]): Pick<CoverText, "category" | "subcategory"> {
  for (const w of words) {
    if (w.confidence < MIN_CONFIDENCE) continue;
    const text = cleanWord(w.text);
    const platform = PLATFORMS.find(([re]) => re.test(text));
    if (platform) return { category: "game", subcategory: platform[1] };
    if (/^playstation$/i.test(text)) return { category: "game" };
  }
  return {};
}

interface TesseractBlock {
  paragraphs?: Array<{
    lines?: Array<{
      words?: Array<{
        text: string;
        confidence: number;
        bbox: { x0?: number; x1?: number; y0: number; y1: number };
      }>;
    }>;
  }>;
}

function wordsFromBlocks(blocks: TesseractBlock[] | null | undefined): OcrWord[] {
  let line = 0;
  return (blocks || []).flatMap((block) =>
    (block.paragraphs || []).flatMap((paragraph) =>
      (paragraph.lines || []).flatMap((ln) => {
        const index = line++;
        return (ln.words || []).map((w) => ({
          text: w.text,
          confidence: w.confidence,
          height: w.bbox.y1 - w.bbox.y0,
          line: index,
          x0: w.bbox.x0,
          x1: w.bbox.x1,
        }));
      })
    )
  );
}

export async function recognizeCoverText(image: File | Blob): Promise<CoverText> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng+pol");

  try {
    // Covers are scattered text over artwork — sparse mode reads them far better than AUTO.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const words = wordsFromBlocks(data.blocks as TesseractBlock[] | null);
    return { query: buildCoverQuery(words), ...detectPlatform(words) };
  } finally {
    await worker.terminate();
  }
}
