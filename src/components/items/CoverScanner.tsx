"use client";

import { useRef, useState } from "react";
import type { CommunityItem } from "@/types/database";
import {
  PHASE_LABEL,
  ScanError,
  completeRecognition,
  lookupMetadata,
  scanCoverFile,
  type ScanPhase as PipelinePhase,
  type ScannedItemData,
} from "@/lib/scan/pipeline";
import { CommunitySearchDialog } from "./CommunitySearchDialog";

export type { ScannedItemData };

/** @deprecated Use ScannedItemData */
export type AiScannedData = ScannedItemData;

interface CoverScannerProps {
  onScanComplete: (data: ScannedItemData) => void;
  onError?: (error: string) => void;
}

type ScanPhase = "idle" | PipelinePhase;

export function CoverScanner({ onScanComplete, onError }: CoverScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [statusText, setStatusText] = useState("");
  const [manualSearch, setManualSearch] = useState<{
    query: string;
    previewUrl?: string;
  } | null>(null);
  // Pop-up over other users' items, opened when recognition and catalogs find nothing.
  const [communitySearch, setCommunitySearch] = useState<{
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
    try {
      const data = await scanCoverFile(file, (next) => {
        setPhase(next);
        setStatusText(PHASE_LABEL[next]);
      });
      if (data.recognized) {
        setPhase("lookup");
        setStatusText(PHASE_LABEL.lookup);
      }
      finishWithData(await completeRecognition(data));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Wystąpił błąd podczas skanowania.";
      const query = err instanceof ScanError ? err.query : "";
      const previewUrl = err instanceof ScanError ? err.previewUrl : undefined;
      onError?.(message);
      setManualSearch({ query, previewUrl });
      setCommunitySearch({ query, previewUrl });
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
      setCommunitySearch({ query, previewUrl: manualSearch.previewUrl });
    } finally {
      setPhase("idle");
      setStatusText("");
    }
  };

  const handleCommunitySelect = (item: CommunityItem) => {
    finishWithData(item, communitySearch?.previewUrl);
    setCommunitySearch(null);
    setManualSearch(null);
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
        className="w-full h-[46px] px-3 rounded-[14px] bg-ac/15 border border-ac/40 text-ac font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
      >
        {busy ? (
          <>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-ac border-t-transparent animate-spin" />
            <span>{statusText}</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="ms text-xl">photo_camera</span>
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
            className="flex-1 min-w-0 h-[42px] px-3 rounded-[14px] bg-bg border border-s2 text-sm text-tx placeholder:text-mu/70 outline-none focus:border-ac"
          />
          <button
            type="button"
            disabled={busy || !manualSearch.query.trim()}
            onClick={() => void handleManualSearch()}
            className="px-3.5 h-[42px] rounded-[14px] bg-ac/15 border border-ac/40 text-ac font-semibold text-sm disabled:opacity-50"
          >
            Szukaj
          </button>
        </div>
      )}

      {communitySearch && (
        <CommunitySearchDialog
          initialQuery={communitySearch.query}
          onSelect={handleCommunitySelect}
          onClose={() => setCommunitySearch(null)}
        />
      )}
    </div>
  );
}

/** @deprecated Use CoverScanner */
export const AiScanButton = CoverScanner;
