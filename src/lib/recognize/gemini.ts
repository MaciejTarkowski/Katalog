import type { CropBox } from "../image/crop";
import { CATALOG_CATEGORIES, isCatalogCategory, type CatalogCategory } from "../catalog/types";

export interface RecognizedCover {
  title: string;
  creator: string | null;
  category: CatalogCategory;
  /** e.g. "PS4", "Winyl", "CD" */
  subcategory: string | null;
  /** Where the cover sits in the photo (fractions of the image); omitted when it fills the frame. */
  box?: CropBox;
}

/** Every model was overloaded / rate-limited / unreachable — caller should fall back. */
export class GeminiUnavailableError extends Error {
  constructor(message = "Usługa rozpoznawania obrazu jest chwilowo niedostępna.") {
    super(message);
    this.name = "GeminiUnavailableError";
  }
}

const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRIES_PER_MODEL = 1;
const TIMEOUT_MS = 20_000;

const PROMPT = `Na zdjęciu jest okładka elementu kolekcji (książka, płyta CD/winyl/kaseta, gra, komiks).
Kolekcja należy do osoby z Polski — wiele pozycji to polskie wydania i polscy wykonawcy.
Najpierw w visible_text przepisz dokładnie wszystkie widoczne napisy i ich fragmenty (także ozdobne kroje, np. gotyckie),
bez zgadywania. Dopiero potem rozpoznaj pozycję tak, by pasowała do tych fragmentów.
Zwróć oficjalny tytuł i twórcę (autor / wykonawca / studio), nie opis zdjęcia.
category: book, music, game, comic albo other.
subcategory: dla gier platforma (np. "PS4", "PS5", "Xbox One", "Switch", "PC"), dla muzyki nośnik ("CD", "Winyl", "Kaseta"), inaczej null.
Jeśli tekst jest częściowo zasłonięty, użyj wiedzy o znanych wydaniach.
cover_box: prostokąt samej okładki na zdjęciu jako ułamki 0–1 całego zdjęcia (x, y = lewy górny róg, w, h = szerokość i wysokość); null, jeśli okładka wypełnia całe zdjęcie.
Jeśli nie potrafisz rozpoznać konkretnej pozycji, ustaw recognized na false — nie wpisuj "brak" ani opisu zdjęcia.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    visible_text: { type: "STRING" },
    recognized: { type: "BOOLEAN" },
    title: { type: "STRING" },
    creator: { type: "STRING", nullable: true },
    category: { type: "STRING", enum: [...CATALOG_CATEGORIES] },
    subcategory: { type: "STRING", nullable: true },
    cover_box: {
      type: "OBJECT",
      nullable: true,
      properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" }, w: { type: "NUMBER" }, h: { type: "NUMBER" } },
      required: ["x", "y", "w", "h"],
    },
  },
  required: ["visible_text", "recognized", "title", "category"],
  propertyOrdering: ["visible_text", "recognized", "title", "creator", "category", "subcategory", "cover_box"],
};

/** Fillers the model writes into required fields when it does not know the answer ("brak", "Nieznany tytuł"). */
const PLACEHOLDER_RE =
  /^(brak|nieznan[yaeo]|unknown|none|null|n\/?a|-+|\?+)(\s+(danych|tytułu|tytuł|informacji|wykonawcy|wykonawca|autora|autor|twórcy|twórca|title|artist))?\.?$/i;

function configuredModels(): string[] {
  const fromEnv = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_MODELS;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function optionalString(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text && !PLACEHOLDER_RE.test(text) ? text : null;
}

const BOX_MARGIN = 0.02;
const MIN_BOX_SIDE = 0.2;
/** A box covering nearly the whole photo is not worth cropping. */
const FULL_FRAME = 0.95;

/** Validates the model's cover rectangle; adds a small margin so the cover is never clipped. */
function parseBox(value: unknown): CropBox | undefined {
  const raw = value as Record<string, unknown> | null | undefined;
  const [x, y, w, h] = ["x", "y", "w", "h"].map((k) => raw?.[k]);
  if (![x, y, w, h].every((n) => typeof n === "number" && Number.isFinite(n))) return undefined;

  // Slight overshoot is rounding noise; a box far outside the photo is a wrong answer.
  const tolerance = 0.05;
  if (
    (x as number) < -tolerance ||
    (y as number) < -tolerance ||
    (x as number) + (w as number) > 1 + tolerance ||
    (y as number) + (h as number) > 1 + tolerance
  ) {
    return undefined;
  }

  const left = Math.max(0, (x as number) - BOX_MARGIN);
  const top = Math.max(0, (y as number) - BOX_MARGIN);
  const right = Math.min(1, (x as number) + (w as number) + BOX_MARGIN);
  const bottom = Math.min(1, (y as number) + (h as number) + BOX_MARGIN);
  const box = { x: left, y: top, w: right - left, h: bottom - top };

  if (box.w < MIN_BOX_SIDE || box.h < MIN_BOX_SIDE) return undefined;
  if (box.w >= FULL_FRAME && box.h >= FULL_FRAME) return undefined;
  return box;
}

export function parseGeminiResponse(json: unknown): RecognizedCover | null {
  const text = (json as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  })?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text;
  if (!text) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (parsed.recognized === false) return null;
  const title = optionalString(parsed.title);
  if (!title) return null;

  const box = parseBox(parsed.cover_box);
  return {
    title,
    creator: optionalString(parsed.creator),
    category: isCatalogCategory(parsed.category) ? parsed.category : "other",
    subcategory: optionalString(parsed.subcategory),
    ...(box ? { box } : {}),
  };
}

async function callModel(model: string, key: string, image: { data: string; mimeType: string }) {
  return fetch(`${API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      contents: [
        {
          parts: [{ inlineData: { mimeType: image.mimeType, data: image.data } }, { text: PROMPT }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    }),
  });
}

/**
 * Recognizes a cover photo. Overload (503/429) and network errors are retried,
 * then the next model is tried; when all fail, throws GeminiUnavailableError.
 * Returns null when the model answered but could not identify the item.
 */
export async function recognizeCover(
  image: { data: string; mimeType: string },
  options: { retryDelayMs?: number } = {}
): Promise<RecognizedCover | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiUnavailableError("Brak klucza GEMINI_API_KEY.");
  const retryDelayMs = options.retryDelayMs ?? 1000;

  for (const model of configuredModels()) {
    for (let attempt = 0; attempt <= RETRIES_PER_MODEL; attempt++) {
      let res: Response;
      try {
        res = await callModel(model, key, image);
      } catch {
        if (attempt < RETRIES_PER_MODEL) await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      if (res.ok) {
        return parseGeminiResponse(await res.json().catch(() => null));
      }
      // 404 = model name not available for this key: skip straight to the next model.
      if (!RETRYABLE_STATUS.has(res.status)) break;
      if (attempt < RETRIES_PER_MODEL) await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw new GeminiUnavailableError();
}
