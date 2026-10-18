"use client";

import { useState } from "react";
import { ItemInsert } from "@/types/database";
import { CoverScanner, ScannedItemData } from "./CoverScanner";
import { uploadCoverImage } from "@/lib/storage/upload";
import { useI18n } from "@/lib/i18n/locale";
import { displayTerm } from "@/lib/items/terms";
import type { MessageKey } from "@/lib/i18n/translate";

interface AddItemFormProps {
  /** Resolves to null on success, or the error message to show. */
  onSubmit: (
    item: Omit<ItemInsert, "id" | "user_id" | "created_at" | "updated_at">
  ) => Promise<string | null>;
  onCancel?: () => void;
  /** Categories the user keeps in the catalog; "Inne" is always offered. */
  types?: string[];
}

const CATEGORIES: Array<{ value: string; label: MessageKey }> = [
  { value: "book", label: "form.cat.book" },
  { value: "music", label: "form.cat.music" },
  { value: "game", label: "form.cat.game" },
  { value: "comic", label: "form.cat.comic" },
  { value: "other", label: "category.other" },
];

export function AddItemForm({ onSubmit, onCancel, types }: AddItemFormProps) {
  const { t } = useI18n();
  const categories = CATEGORIES.filter((c) => c.value === "other" || !types || types.includes(c.value));
  const [title, setTitle] = useState("");
  const [artistCreator, setArtistCreator] = useState("");
  const [category, setCategory] = useState(categories[0].value);
  const [subcategory, setSubcategory] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);

  const handleScanComplete = (data: ScannedItemData) => {
    if (data.title) setTitle(data.title);
    if (data.artist_creator) setArtistCreator(data.artist_creator);
    if (data.category) setCategory(data.category);
    if (data.subcategory) setSubcategory(displayTerm(data.subcategory, t));
    if (data.metadata) setMetadata(data.metadata);
    if (data.cover_url) {
      setCoverUrl(data.cover_url);
    } else if (data.previewUrl && !coverUrl) {
      setCoverUrl(data.previewUrl);
    }
    setAiSuccessMsg(t("form.fetched"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg(t("form.titleRequired"));
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    let finalCoverUrl = coverUrl.trim() || null;
    if (finalCoverUrl && finalCoverUrl.startsWith("data:image/")) {
      const { publicUrl, error: uploadError } = await uploadCoverImage(finalCoverUrl);
      if (uploadError) {
        setErrorMsg(t("form.uploadError", { error: uploadError }));
        setSubmitting(false);
        return;
      }
      if (publicUrl) {
        finalCoverUrl = publicUrl;
      }
    }

    const addError = await onSubmit({
      title: title.trim(),
      artist_creator: artistCreator.trim() || null,
      category,
      subcategory: subcategory.trim() || null,
      cover_url: finalCoverUrl,
      metadata,
    });

    setSubmitting(false);

    if (!addError) {
      setTitle("");
      setArtistCreator("");
      setSubcategory("");
      setCoverUrl("");
      setMetadata({});
      setAiSuccessMsg(null);
    } else {
      setErrorMsg(addError);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between pb-2 border-b border-s2">
        <h3 className="text-lg font-extrabold tracking-[-.02em]">{t("form.title")}</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-mu"
          >
            {t("common.close")}
          </button>
        )}
      </div>

      <CoverScanner
        onScanComplete={handleScanComplete}
        onError={(err) => setErrorMsg(err)}
      />

      {aiSuccessMsg && (
        <div
          role="status"
          className="p-3 rounded-[14px] bg-ac/10 border border-ac/30 text-ac text-sm flex items-center gap-1.5"
        >
          <span>✨</span>
          <span>{aiSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-3 rounded-[14px] bg-rose-500/10 border border-rose-500/25 text-rose-400 text-sm">
          {errorMsg}
        </div>
      )}

      <div>
        <label htmlFor="item-title" className="block text-[13px] font-medium text-mu mb-1.5">
          {t("form.titleLabel")}
        </label>
        <input
          id="item-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("form.titlePlaceholder")}
          className="w-full h-[46px] px-3.5 rounded-[14px] bg-bg border border-s2 text-tx placeholder:text-mu/70 text-[15px] outline-none focus:border-ac"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="item-category" className="block text-[13px] font-medium text-mu mb-1.5">
            {t("form.category")}
          </label>
          <select
            id="item-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-[46px] px-3 rounded-[14px] bg-bg border border-s2 text-tx text-[15px] outline-none focus:border-ac"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {t(cat.label)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="item-artist" className="block text-[13px] font-medium text-mu mb-1.5">
            {t("form.creator")}
          </label>
          <input
            id="item-artist"
            type="text"
            value={artistCreator}
            onChange={(e) => setArtistCreator(e.target.value)}
            placeholder={t("form.creatorPlaceholder")}
            className="w-full h-[46px] px-3.5 rounded-[14px] bg-bg border border-s2 text-tx placeholder:text-mu/70 text-[15px] outline-none focus:border-ac"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="item-subcategory" className="block text-[13px] font-medium text-mu mb-1.5">
            {t("form.subcategory")}
          </label>
          <input
            id="item-subcategory"
            type="text"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            placeholder={t("form.subcategoryPlaceholder")}
            className="w-full h-[46px] px-3.5 rounded-[14px] bg-bg border border-s2 text-tx placeholder:text-mu/70 text-[15px] outline-none focus:border-ac"
          />
        </div>

        <div>
          <label htmlFor="item-cover" className="block text-[13px] font-medium text-mu mb-1.5">
            {t("form.coverUrl")}
          </label>
          <input
            id="item-cover"
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://..."
            className="w-full h-[46px] px-3.5 rounded-[14px] bg-bg border border-s2 text-tx placeholder:text-mu/70 text-[15px] outline-none focus:border-ac"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full mt-2 h-[54px] rounded-2xl bg-ac text-act font-semibold text-base disabled:opacity-50"
      >
        {submitting ? t("common.saving") : t("form.submit")}
      </button>
    </form>
  );
}
