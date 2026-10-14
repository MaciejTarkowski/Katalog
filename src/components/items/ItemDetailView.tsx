"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Item } from "@/types/database";
import { fetchItemById } from "@/lib/items/api";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "./ItemCard";

interface ItemDetailViewProps {
  itemId: string;
  fromShare?: boolean;
}

const METADATA_LABELS: Record<string, string> = {
  year: "Rok",
  publisher: "Wydawca",
  isbn: "ISBN",
  barcode: "Kod kreskowy",
  genre: "Gatunek",
  platform: "Platforma",
  label: "Wytwórnia",
  format: "Format",
  country: "Kraj",
  pages: "Liczba stron",
  source: "Źródło",
};

/** Readable metadata rows: primitives (and string lists) only, no technical ids. */
function metadataRows(metadata: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(metadata || {}).flatMap(([key, value]): Array<[string, string]> => {
    if (key.endsWith("_id")) return [];
    const text = Array.isArray(value)
      ? value.filter((v) => typeof v === "string" || typeof v === "number").join(", ")
      : typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
    if (!text) return [];
    return [[METADATA_LABELS[key] || key, text]];
  });
}

export function ItemDetailView({ itemId, fromShare }: ItemDetailViewProps) {
  const [item, setItem] = useState<Item | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchItemById(itemId).then(({ data, error }) => {
      if (cancelled) return;
      setItem(data);
      setErrorMsg(error);
    });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const backLink = (
    <Link
      href={fromShare && item ? `/share/${item.user_id}` : "/"}
      className="self-start text-xs text-slate-400 hover:text-white transition-colors"
    >
      ← Wróć do kolekcji
    </Link>
  );

  if (errorMsg) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-md">
        {backLink}
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center"
        >
          {errorMsg}
        </div>
      </div>
    );
  }

  if (!item) {
    return <div className="text-xs text-slate-400 py-8">Ładowanie elementu...</div>;
  }

  const categoryLabel = CATEGORY_LABELS[item.category] || item.category;
  const categoryColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other;
  const rows = metadataRows(item.metadata);

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl">
      {backLink}

      <article className="flex flex-col sm:flex-row gap-6">
        <div className="relative w-48 sm:w-64 mx-auto sm:mx-0 aspect-[2/3] flex-shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-800 shadow-xl">
          {item.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-slate-600">
              {item.title.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${categoryColor}`}>
              {categoryLabel}
            </span>
            {item.subcategory && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                {item.subcategory}
              </span>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight break-words">{item.title}</h2>
            {item.artist_creator && (
              <p className="text-sm text-slate-400 mt-1">{item.artist_creator}</p>
            )}
          </div>

          {rows.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-slate-200 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <p className="text-[11px] text-slate-500">
            Dodano: {new Date(item.created_at).toLocaleDateString("pl-PL")}
          </p>
        </div>
      </article>
    </div>
  );
}
