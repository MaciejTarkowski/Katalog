"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/image/compress";
import { detectBarcodeFromFile } from "@/lib/scan/barcode";
import { recognizeCoverText } from "@/lib/scan/ocr";

export interface ScannedItemData {
  title: string;
  artist_creator: string | null;
  category: string;
  subcategory: string | null;
  cover_url?: string | null;
  metadata: Record<string, unknown>;
  previewUrl?: string;
}

/** @deprecated Use ScannedItemData */
export type AiScannedData = ScannedItemData;

interface CoverScannerProps {
  onScanComplete: (data: ScannedItemData) => void;
  onError?: (error: string) => void;
}

type ScanPhase =
  | "idle"
  | "compressing"
  | "barcode"
  | "recognize"
  | "ocr"
  | "lookup";

const PHASE_LABEL: Record<Exclude<ScanPhase, "idle">, string> = {
  compressing: "Kompresja zdjęcia...",
  barcode: "Szukam kodu kreskowego...",
  recognize: "Rozpoznawanie okładki...",
  ocr: "Rozpoznawanie tekstu (OCR)...",
  lookup: "Dociąganie danych z baz katalogowych...",
};

/** Vision recognition on the server; null means "not available, fall back to local OCR". */
async function recognizeWithVision(imageDataUrl: string): Promise<ScannedItemData | null> {
  try {
    const res = await fetch("/api/catalog/recognize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
    });
    const json = await res.json();
    return res.ok && json.success ? (json.data as ScannedItemData) : null;
  } catch {
    return null;
  }
}

async function lookupMetadata(payload: {
  ean?: string;
  query?: string;
  category?: string;
}): Promise<ScannedItemData> {
  const res = await fetch("/api/catalog/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Nie udało się pobrać metadanych.");
  }
  return json.data as ScannedItemData;
}

export function CoverScanner({ onScanComplete, onError }: CoverScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [statusText, setStatusText] = useState("");
  const [manualSearch, setManualSearch] = useState<{
    query: string;
    previewUrl?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = phase !== "idle";

  const finishWithData = (data: ScannedItemData, previewUrl?: string) => {
    onScanComplete({
      ...data,
      previewUrl: previewUrl || data.previewUrl,
    });
  };

  const handleLookup = async (
    payload: { ean?: string; query?: string; category?: string },
    previewUrl?: string,
    subcategory?: string
  ) => {
    setPhase("lookup");
    setStatusText(PHASE_LABEL.lookup);
    const data = await lookupMetadata(payload);
    finishWithData(subcategory ? { ...data, subcategory } : data, previewUrl);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setManualSearch(null);
    setPhase("compressing");
    setStatusText(PHASE_LABEL.compressing);
    let previewUrl: string | undefined;
    let ocrText = "";

    try {
      const compressed = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
      });
      previewUrl = compressed.dataUrl;

      setPhase("barcode");
      setStatusText(PHASE_LABEL.barcode);
      const barcode = await detectBarcodeFromFile(file);

      if (barcode) {
        await handleLookup({ ean: barcode }, compressed.dataUrl);
        return;
      }

      setPhase("recognize");
      setStatusText(PHASE_LABEL.recognize);
      const recognized = await recognizeWithVision(compressed.dataUrl);
      if (recognized) {
        finishWithData(recognized, compressed.dataUrl);
        return;
      }

      setPhase("ocr");
      setStatusText(PHASE_LABEL.ocr);
      const cover = await recognizeCoverText(file);
      ocrText = cover.query;
      if (!ocrText) {
        throw new Error("Nie udało się odczytać tekstu z okładki. Wpisz tytuł ręcznie.");
      }

      await handleLookup(
        { query: ocrText, category: cover.category },
        compressed.dataUrl,
        cover.subcategory
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Wystąpił błąd podczas skanowania.";
      onError?.(message);
      setManualSearch({ query: ocrText, previewUrl });
    } finally {
      setPhase("idle");
      setStatusText("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleManualSearch = async () => {
    const query = manualSearch?.query.trim();
    if (!manualSearch || !query) return;

    try {
      await handleLookup({ query }, manualSearch.previewUrl);
      setManualSearch(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Wystąpił błąd podczas wyszukiwania.";
      onError?.(message);
    } finally {
      setPhase("idle");
      setStatusText("");
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        data-testid="cover-scan-file-input"
        disabled={busy}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-600/30 hover:from-violet-600/40 hover:to-indigo-600/40 border border-violet-500/30 text-violet-300 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
      >
        {busy ? (
          <>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            <span>{statusText}</span>
          </>
        ) : (
          <>
            <span className="text-sm">📷</span>
            <span>Zeskanuj okładkę</span>
          </>
        )}
      </button>

      {manualSearch && (
        <div className="flex gap-2">
          <input
            type="text"
            aria-label="Popraw odczytany tekst i wyszukaj ponownie"
            placeholder="Wpisz tytuł z okładki"
            value={manualSearch.query}
            disabled={busy}
            onChange={(e) => setManualSearch({ ...manualSearch, query: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleManualSearch();
              }
            }}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
          />
          <button
            type="button"
            disabled={busy || !manualSearch.query.trim()}
            onClick={() => void handleManualSearch()}
            className="px-3 py-2 rounded-xl bg-violet-600/30 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 hover:text-white font-medium text-xs transition-all disabled:opacity-50"
          >
            Szukaj
          </button>
        </div>
      )}
    </div>
  );
}

/** @deprecated Use CoverScanner */
export const AiScanButton = CoverScanner;
