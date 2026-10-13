"use client";

import { useState } from "react";
import { ItemInsert } from "@/types/database";
import { AiScanButton, AiScannedData } from "./AiScanButton";
import { uploadCoverImage } from "@/lib/storage/upload";

interface AddItemFormProps {
  onSubmit: (item: Omit<ItemInsert, "id" | "user_id" | "created_at" | "updated_at">) => Promise<boolean>;
  onCancel?: () => void;
}

const CATEGORIES = [
  { value: "book", label: "Książka" },
  { value: "music", label: "Muzyka" },
  { value: "game", label: "Gra wideo" },
  { value: "comic", label: "Komiks" },
  { value: "other", label: "Inne" },
];

export function AddItemForm({ onSubmit, onCancel }: AddItemFormProps) {
  const [title, setTitle] = useState("");
  const [artistCreator, setArtistCreator] = useState("");
  const [category, setCategory] = useState("book");
  const [subcategory, setSubcategory] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);

  const handleScanComplete = (data: AiScannedData) => {
    if (data.title) setTitle(data.title);
    if (data.artist_creator) setArtistCreator(data.artist_creator);
    if (data.category) setCategory(data.category);
    if (data.subcategory) setSubcategory(data.subcategory);
    if (data.metadata) setMetadata(data.metadata);
    if (data.previewUrl && !coverUrl) setCoverUrl(data.previewUrl);
    setAiSuccessMsg("Pomyślnie rozpoznano dane przez Gemini AI!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Tytuł jest wymagany");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    let finalCoverUrl = coverUrl.trim() || null;
    if (finalCoverUrl && finalCoverUrl.startsWith("data:image/")) {
      const { publicUrl } = await uploadCoverImage(finalCoverUrl);
      if (publicUrl) {
        finalCoverUrl = publicUrl;
      }
    }

    const success = await onSubmit({
      title: title.trim(),
      artist_creator: artistCreator.trim() || null,
      category,
      subcategory: subcategory.trim() || null,
      cover_url: finalCoverUrl,
      metadata,
    });

    setSubmitting(false);

    if (success) {
      setTitle("");
      setArtistCreator("");
      setSubcategory("");
      setCoverUrl("");
      setMetadata({});
      setAiSuccessMsg(null);
    } else {
      setErrorMsg("Nie udało się zapisać elementu.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3 shadow-lg"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white">Dodaj nowy element</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Zamknij
          </button>
        )}
      </div>

      {/* Gemini AI Auto-Scan */}
      <AiScanButton
        onScanComplete={handleScanComplete}
        onError={(err) => setErrorMsg(err)}
      />

      {aiSuccessMsg && (
        <div
          role="status"
          className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs flex items-center gap-1.5"
        >
          <span>✨</span>
          <span>{aiSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {errorMsg}
        </div>
      )}

      <div>
        <label htmlFor="item-title" className="block text-xs font-medium text-slate-300 mb-1">
          Tytuł *
        </label>
        <input
          id="item-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="np. Władca Pierścieni / Dark Side of the Moon"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="item-category" className="block text-xs font-medium text-slate-300 mb-1">
            Kategoria
          </label>
          <select
            id="item-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="item-artist" className="block text-xs font-medium text-slate-300 mb-1">
            Twórca / Wykonawca
          </label>
          <input
            id="item-artist"
            type="text"
            value={artistCreator}
            onChange={(e) => setArtistCreator(e.target.value)}
            placeholder="np. Pink Floyd / J.R.R. Tolkien"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="item-subcategory" className="block text-xs font-medium text-slate-300 mb-1">
            Podkategoria / Format
          </label>
          <input
            id="item-subcategory"
            type="text"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            placeholder="np. Winyl, Fantasy, PS5"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="item-cover" className="block text-xs font-medium text-slate-300 mb-1">
            URL Okładki
          </label>
          <input
            id="item-cover"
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-medium text-xs transition-all shadow-md shadow-blue-600/20"
      >
        {submitting ? "Zapisywanie..." : "Dodaj do kolekcji"}
      </button>
    </form>
  );
}
