import { CATALOG_CATEGORIES, isCatalogCategory, type CatalogCategory } from "../catalog/types";

export interface RecognizedCover {
  title: string;
  creator: string | null;
  category: CatalogCategory;
  /** e.g. "PS4", "Winyl", "CD" */
  subcategory: string | null;
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
Jeśli tekst jest częściowo zasłonięty, użyj wiedzy o znanych wydaniach.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    visible_text: { type: "STRING" },
    title: { type: "STRING" },
    creator: { type: "STRING", nullable: true },
    category: { type: "STRING", enum: [...CATALOG_CATEGORIES] },
    subcategory: { type: "STRING", nullable: true },
  },
  required: ["visible_text", "title", "category"],
  propertyOrdering: ["visible_text", "title", "creator", "category", "subcategory"],
};

function configuredModels(): string[] {
  const fromEnv = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_MODELS;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

  const title = optionalString(parsed.title);
  if (!title) return null;

  return {
    title,
    creator: optionalString(parsed.creator),
    category: isCatalogCategory(parsed.category) ? parsed.category : "other",
    subcategory: optionalString(parsed.subcategory),
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
