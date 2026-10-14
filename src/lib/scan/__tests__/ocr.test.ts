import { describe, it, expect, vi, beforeEach } from "vitest";

const recognize = vi.fn();
const setParameters = vi.fn();
const terminate = vi.fn();
const createWorker = vi.fn();

vi.mock("tesseract.js", () => ({
  createWorker: (...args: unknown[]) => createWorker(...args),
  PSM: { SPARSE_TEXT: "11" },
}));

import {
  buildCoverQuery,
  detectPlatform,
  mergeSpacedLetters,
  recognizeCoverText,
  type OcrWord,
} from "../ocr";

function word(text: string, confidence: number, height: number): OcrWord {
  return { text, confidence, height };
}

function blocksOf(words: OcrWord[]) {
  return [
    {
      paragraphs: [
        {
          lines: [
            {
              words: words.map((w) => ({
                text: w.text,
                confidence: w.confidence,
                bbox: { x0: 0, y0: 0, x1: 10, y1: w.height },
              })),
            },
          ],
        },
      ],
    },
  ];
}

describe("buildCoverQuery", () => {
  it("keeps large, confident words and drops cover boilerplate (przyklad.jpeg)", () => {
    // Słowa odczytane przez Tesseract z przyklad.jpeg (PSM 11).
    const words = [
      word("dy", 40, 30),
      word("Tylko", 65, 30),
      word("PlayStation", 72, 30),
      word("MAN", 96, 157),
      word("GRAW", 90, 24),
      word("POLSKIEJ", 96, 25),
      word("WERSJI", 95, 25),
      word("JĘZYKOWEJ", 93, 33),
      word("INSOMNIAC", 90, 42),
      word("www.pegi.info", 91, 24),
      word("GAMES", 94, 13),
      word("¥", 92, 50),
    ];
    expect(buildCoverQuery(words)).toBe("MAN INSOMNIAC");
  });

  it("orders words from the largest text (title first)", () => {
    const words = [
      word("Tolkien", 90, 40),
      word("The", 92, 80),
      word("Hobbit", 95, 90),
    ];
    expect(buildCoverQuery(words)).toBe("Hobbit The Tolkien");
  });

  it("rejoins letter-spaced author and title (ksiazka.jpeg)", () => {
    const spaced = (text: string, line: number, height: number, start: number) =>
      [...text].flatMap((ch, i) =>
        ch === " " ? [] : [{ text: ch, confidence: 90, height, line, x0: start + i * 40, x1: start + i * 40 + 22 }]
      );
    const words: OcrWord[] = [
      ...spaced("REMIGIUSZ", 0, 30, 0),
      { text: "MRÓZ", confidence: 95, height: 120, line: 1 },
      ...spaced("SZEPTY  SPOZA  NICOŚCI", 2, 28, 0),
      { text: "FILIA", confidence: 92, height: 26, line: 3 },
    ];
    expect(buildCoverQuery(words)).toBe("MRÓZ REMIGIUSZ SZEPTY SPOZA NICOŚCI FILIA");
  });

  it("returns an empty string when nothing is readable", () => {
    expect(buildCoverQuery([word("x", 20, 10), word("~~", 90, 10)])).toBe("");
  });
});

describe("mergeSpacedLetters", () => {
  it("leaves short runs and runs across lines alone", () => {
    const words: OcrWord[] = [
      { text: "A", confidence: 90, height: 10, line: 0 },
      { text: "B", confidence: 90, height: 10, line: 0 },
      { text: "C", confidence: 90, height: 10, line: 1 },
      { text: "Hobbit", confidence: 90, height: 10, line: 1 },
    ];
    expect(mergeSpacedLetters(words).map((w) => w.text)).toEqual(["A", "B", "C", "Hobbit"]);
  });
});

describe("detectPlatform", () => {
  it("suggests a game on PS4 from the cover banner (gra.jpeg)", () => {
    expect(detectPlatform([word("PS4", 88, 40), word("PlayStation", 90, 30)])).toEqual({
      category: "game",
      subcategory: "PS4",
    });
  });

  it("suggests nothing for a book", () => {
    expect(detectPlatform([word("MRÓZ", 95, 120)])).toEqual({});
  });
});

describe("recognizeCoverText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createWorker.mockResolvedValue({ recognize, setParameters, terminate });
    setParameters.mockResolvedValue(undefined);
    terminate.mockResolvedValue(undefined);
  });

  it("uses sparse-text mode, filters words and terminates the worker", async () => {
    recognize.mockResolvedValue({
      data: {
        text: "noise",
        blocks: blocksOf([word("Hobbit", 95, 90), word("pegi", 95, 90), word("zz", 30, 90)]),
      },
    });

    const file = new File(["img"], "cover.jpg", { type: "image/jpeg" });
    await expect(recognizeCoverText(file)).resolves.toEqual({ query: "Hobbit" });
    expect(createWorker).toHaveBeenCalledWith("eng+pol");
    expect(setParameters).toHaveBeenCalledWith({ tessedit_pageseg_mode: "11" });
    expect(recognize).toHaveBeenCalledWith(file, {}, { blocks: true });
    expect(terminate).toHaveBeenCalled();
  });

  it("terminates the worker when recognition fails", async () => {
    recognize.mockRejectedValue(new Error("boom"));
    await expect(recognizeCoverText(new Blob(["img"]))).rejects.toThrow("boom");
    expect(terminate).toHaveBeenCalled();
  });
});
