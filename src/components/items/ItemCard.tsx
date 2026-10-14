"use client";

import Link from "next/link";
import { Item } from "@/types/database";

interface ItemCardProps {
  item: Item;
  onDelete?: (id: string) => void;
  /** Card shown in a shared collection — the detail page links back to it. */
  fromShare?: boolean;
}

export const CATEGORY_LABELS: Record<string, string> = {
  book: "Książka",
  music: "Muzyka",
  game: "Gra",
  comic: "Komiks",
  other: "Inne",
};

export const CATEGORY_COLORS: Record<string, string> = {
  book: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  music: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  game: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  comic: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  other: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export function ItemCard({ item, onDelete, fromShare }: ItemCardProps) {
  const categoryLabel = CATEGORY_LABELS[item.category] || item.category;
  const categoryColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other;

  return (
    <article data-testid={`item-card-${item.id}`} className="group flex flex-col min-w-0">
      <Link href={`/item/${item.id}${fromShare ? "?from=share" : ""}`} className="flex flex-col gap-1.5 min-w-0">
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-800 group-hover:border-slate-600 shadow-md transition-all group-hover:scale-[1.03]">
          {item.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.cover_url}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-slate-600">
              {item.title.charAt(0).toUpperCase()}
            </span>
          )}
          <span
            className={`absolute top-1.5 left-1.5 text-[10px] px-2 py-0.5 rounded-full font-semibold border backdrop-blur ${categoryColor}`}
          >
            {categoryLabel}
          </span>
        </div>

        <div className="min-w-0 px-0.5">
          <h3 className="text-xs font-semibold text-white truncate">{item.title}</h3>
          {item.artist_creator && (
            <p className="text-[11px] text-slate-400 truncate">{item.artist_creator}</p>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 mt-0.5 px-0.5">
        {item.subcategory ? (
          <span className="text-[10px] text-slate-500 truncate">{item.subcategory}</span>
        ) : (
          <span />
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            aria-label={`Usuń ${item.title}`}
            className="text-[10px] text-rose-400 hover:text-rose-300 font-medium transition-colors flex-shrink-0"
          >
            Usuń
          </button>
        )}
      </div>
    </article>
  );
}
