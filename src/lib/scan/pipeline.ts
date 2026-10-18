import { cropImage, type CropBox } from "@/lib/image/crop";
import { compressImage } from "@/lib/image/compress";
import { detectBarcodeFromFile } from "@/lib/scan/barcode";
import { recognizeCoverText } from "@/lib/scan/ocr";
import { SEARCH_LIMIT } from "@/lib/catalog/searchConfig";
import type { RecognizedCover } from "@/lib/recognize/gemini";
import { localeHeaders, t } from "@/lib/i18n/locale";

export interface ScannedItemData {
  title: string;
  artist_creator: string | null;
  category: string;
  subcategory: string | null;
  cover_url?: string | null;
  metadata: Record<string, unknown>;
  previewUrl?: string;
  /** Where the cover sits in the photo, from vision recognition. */
  cover_box?: CropBox;
  /**
   * Set while the catalog cover and details are still coming: what vision recognized, to be
   * passed on by `completeRecognition`.
   */
  recognized?: RecognizedCover;
}

export type ScanPhase = "compressing" | "barcode" | "recognize" | "ocr" | "lookup";

/** Status text per phase, in the current UI language (read on use). */
export const PHASE_LABEL: Readonly<Record<ScanPhase, string>> = {
  get compressing() {
    return t("scan.phase.compressing");
  },
  get barcode() {
    return t("scan.phase.barcode");
  },
  get recognize() {
    return t("scan.phase.recognize");
  },
  get ocr() {
    return t("scan.phase.ocr");
  },
  get lookup() {
    return t("scan.phase.lookup");
  },
};

/** Thrown when nothing was found; carries what is known so far for a manual search. */
export class ScanError extends Error {
  constructor(
    message: string,
    readonly query: string,
    readonly previewUrl?: string
  ) {
    super(message);
    this.name = "ScanError";
  }
}

/** Vision recognition on the server; null means "not available, fall back to local OCR". */
async function recognizeWithVision(imageDataUrl: string): Promise<ScannedItemData | null> {
  try {
    const res = await fetch("/api/catalog/recognize", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...localeHeaders() },
      body: JSON.stringify({ image: imageDataUrl }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) return null;
    const data = json.data as ScannedItemData;
    return json.recognized ? { ...data, recognized: json.recognized as RecognizedCover } : data;
  } catch {
    return null;
  }
}

/**
 * Second step of a vision scan: adds the catalog cover and details to a result that still has
 * `recognized`. Never throws — when the catalogs fail, the recognition is kept as it is.
 */
export async function completeRecognition(data: ScannedItemData): Promise<ScannedItemData> {
  const { recognized, ...known } = data;
  if (!recognized) return known;
  try {
    const res = await fetch("/api/catalog/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...localeHeaders() },
      body: JSON.stringify({ recognized }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) return known;
    return { ...(json.data as ScannedItemData), previewUrl: known.previewUrl };
  } catch {
    return known;
  }
}

export async function lookupMetadata(payload: {
  ean?: string;
  query?: string;
  category?: string;
}): Promise<ScannedItemData> {
  const res = await fetch("/api/catalog/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...localeHeaders() },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || t("scan.lookupFailed"));
  }
  return json.data as ScannedItemData;
}

export interface CatalogSearchPage {
  items: ScannedItemData[];
  hasMore: boolean;
}

/** Text search, one page (`SEARCH_LIMIT` items) at a time; `page` starts at 0. */
export async function searchCatalogItems(
  query: string,
  { category, page = 0 }: { category?: string; page?: number } = {}
): Promise<CatalogSearchPage> {
  const res = await fetch("/api/catalog/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...localeHeaders() },
    body: JSON.stringify({ query, category, offset: page * SEARCH_LIMIT }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || t("scan.searchFailed"));
  }
  return { items: json.data as ScannedItemData[], hasMore: Boolean(json.hasMore) };
}

/**
 * Photo → item data: compress, barcode, Gemini vision, local OCR + catalog lookup.
 * Throws ScanError (with the OCR text, if any) when nothing is found.
 */
export async function scanCoverFile(
  file: File,
  onPhase: (phase: ScanPhase) => void
): Promise<ScannedItemData> {
  let previewUrl: string | undefined;
  let ocrText = "";
  const withPreview = async (data: ScannedItemData): Promise<ScannedItemData> => {
    let preview = previewUrl || data.previewUrl;
    // The photo is used as the cover when no catalog cover exists: keep only the cover itself.
    if (preview && data.cover_box && !data.cover_url) {
      preview = await cropImage(preview, data.cover_box).catch(() => preview);
    }
    return { ...data, previewUrl: preview };
  };

  try {
    onPhase("compressing");
    const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
    previewUrl = compressed.dataUrl;

    onPhase("barcode");
    const barcode = await detectBarcodeFromFile(file);
    if (barcode) {
      onPhase("lookup");
      return await withPreview(await lookupMetadata({ ean: barcode }));
    }

    onPhase("recognize");
    const recognized = await recognizeWithVision(compressed.dataUrl);
    if (recognized) return await withPreview(recognized);

    onPhase("ocr");
    const cover = await recognizeCoverText(file);
    ocrText = cover.query;
    if (!ocrText) {
      throw new Error(t("scan.noText"));
    }

    onPhase("lookup");
    const data = await lookupMetadata({ query: ocrText, category: cover.category });
    return await withPreview(cover.subcategory ? { ...data, subcategory: cover.subcategory } : data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("scan.error");
    throw new ScanError(message, ocrText, previewUrl);
  }
}
