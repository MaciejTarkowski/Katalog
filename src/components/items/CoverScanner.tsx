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
  | "ocr"
  | "lookup";

const PHASE_LABEL: Record<Exclude<ScanPhase, "idle">, string> = {
  compressing: "Kompresja zdjęcia...",
  barcode: "Szukam kodu kreskowego...",
  ocr: "Rozpoznawanie tekstu (OCR)...",
  lookup: "Dociąganie danych z baz katalogowych...",
};

async function lookupMetadata(payload: {
  ean?: string;
  query?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = phase !== "idle";

  const finishWithData = (data: ScannedItemData, previewUrl?: string) => {
    onScanComplete({
      ...data,
      previewUrl: previewUrl || data.previewUrl,
    });
  };

  const handleLookup = async (payload: { ean?: string; query?: string }, previewUrl?: string) => {
    setPhase("lookup");
    setStatusText(PHASE_LABEL.lookup);
    const data = await lookupMetadata(payload);
    finishWithData(data, previewUrl);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhase("compressing");
    setStatusText(PHASE_LABEL.compressing);

    try {
      const compressed = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
      });

      setPhase("barcode");
      setStatusText(PHASE_LABEL.barcode);
      const barcode = await detectBarcodeFromFile(file);

      if (barcode) {
        await handleLookup({ ean: barcode }, compressed.dataUrl);
        return;
      }

      setPhase("ocr");
      setStatusText(PHASE_LABEL.ocr);
      const text = await recognizeCoverText(file);
      if (!text) {
        throw new Error("Nie udało się odczytać tekstu z okładki.");
      }

      await handleLookup({ query: text }, compressed.dataUrl);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Wystąpił błąd podczas skanowania.";
      onError?.(message);
    } finally {
      setPhase("idle");
      setStatusText("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
    </div>
  );
}

/** @deprecated Use CoverScanner */
export const AiScanButton = CoverScanner;
