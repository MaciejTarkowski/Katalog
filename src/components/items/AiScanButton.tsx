"use client";

import { useState, useRef } from "react";
import { compressImage } from "@/lib/image/compress";

export interface AiScannedData {
  title: string;
  artist_creator: string | null;
  category: string;
  subcategory: string | null;
  metadata: Record<string, unknown>;
  previewUrl?: string;
}

interface AiScanButtonProps {
  onScanComplete: (data: AiScannedData) => void;
  onError?: (error: string) => void;
}

export function AiScanButton({ onScanComplete, onError }: AiScanButtonProps) {
  const [scanning, setScanning] = useState(false);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setStatusText("Kompresja zdjęcia...");

    try {
      // 1. Client-side compression
      const compressed = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
      });

      setStatusText("Analiza okładki przez Gemini AI...");

      // 2. Call server route handler
      const res = await fetch("/api/ai/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Nie udało się rozpoznać przedmiotu.");
      }

      onScanComplete({
        ...json.data,
        previewUrl: compressed.dataUrl,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Wystąpił błąd podczas skanowania.";
      if (onError) onError(message);
    } finally {
      setScanning(false);
      setStatusText("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        data-testid="ai-scan-file-input"
        disabled={scanning}
      />

      <button
        type="button"
        disabled={scanning}
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-600/30 hover:from-violet-600/40 hover:to-indigo-600/40 border border-violet-500/30 text-violet-300 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
      >
        {scanning ? (
          <>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            <span>{statusText}</span>
          </>
        ) : (
          <>
            <span className="text-sm">✨</span>
            <span>Zeskanuj okładkę aparatem (Gemini AI)</span>
          </>
        )}
      </button>
    </div>
  );
}
