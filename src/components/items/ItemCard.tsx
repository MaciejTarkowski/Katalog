"use client";

import { Item } from "@/types/database";

interface ItemCardProps {
  item: Item;
  onDelete?: (id: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  book: "Książka",
  music: "Muzyka",
  game: "Gra",
  comic: "Komiks",
  other: "Inne",
};

const CATEGORY_COLORS: Record<string, string> = {
  book: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  music: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  game: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  comic: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  other: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export function ItemCard({ item, onDelete }: ItemCardProps) {
  const categoryLabel = CATEGORY_LABELS[item.category] || item.category;
  const categoryColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other;

  return (
    <article
      data-testid={`item-card-${item.id}`}
      className="flex gap-4 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-sm"
    >
      <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center border border-slate-700/50">
        {item.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.cover_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xl font-bold text-slate-600">
            {item.title.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${categoryColor}`}
            >
              {categoryLabel}
            </span>
            {item.subcategory && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                {item.subcategory}
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
          {item.artist_creator && (
            <p className="text-xs text-slate-400 truncate">{item.artist_creator}</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80">
          <time className="text-[10px] text-slate-500">
            {new Date(item.created_at).toLocaleDateString("pl-PL")}
          </time>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              aria-label={`Usuń ${item.title}`}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium transition-colors"
            >
              Usuń
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
