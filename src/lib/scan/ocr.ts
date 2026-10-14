export interface OcrWord {
  text: string;
  confidence: number;
  height: number;
}

const MIN_CONFIDENCE = 70;
/** Words much smaller than the largest text (title) are usually labels, ratings, fine print. */
const MIN_RELATIVE_HEIGHT = 0.25;
const MAX_WORDS = 8;

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

function cleanWord(text: string): string {
  return text.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
}

function isUsefulWord(text: string): boolean {
  if ((text.match(/[\p{L}\d]/gu) || []).length < 2) return false;
  const lower = text.toLowerCase();
  if (lower.startsWith("www") || /\.(info|com|pl|net|org)$/.test(lower)) return false;
  return !STOP_WORDS.has(lower);
}

/** Turns raw OCR words into a short search query, largest (title) text first. */
export function buildCoverQuery(words: OcrWord[]): string {
  const candidates = words
    .filter((w) => w.confidence >= MIN_CONFIDENCE)
    .map((w) => ({ ...w, text: cleanWord(w.text) }))
    .filter((w) => isUsefulWord(w.text));
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

interface TesseractBlock {
  paragraphs?: Array<{
    lines?: Array<{
      words?: Array<{ text: string; confidence: number; bbox: { y0: number; y1: number } }>;
    }>;
  }>;
}

function wordsFromBlocks(blocks: TesseractBlock[] | null | undefined): OcrWord[] {
  return (blocks || []).flatMap((block) =>
    (block.paragraphs || []).flatMap((paragraph) =>
      (paragraph.lines || []).flatMap((line) =>
        (line.words || []).map((w) => ({
          text: w.text,
          confidence: w.confidence,
          height: w.bbox.y1 - w.bbox.y0,
        }))
      )
    )
  );
}

export async function recognizeCoverText(image: File | Blob): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng+pol");

  try {
    // Covers are scattered text over artwork — sparse mode reads them far better than AUTO.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(image, {}, { blocks: true });
    return buildCoverQuery(wordsFromBlocks(data.blocks as TesseractBlock[] | null));
  } finally {
    await worker.terminate();
  }
}
