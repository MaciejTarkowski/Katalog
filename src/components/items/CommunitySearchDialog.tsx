"use client";

import { useEffect, useState } from "react";
import { searchCommunityItems } from "@/lib/items/api";
import type { CommunityItem } from "@/types/database";

const CATEGORY_LABELS: Record<string, string> = {
  book: "Książka",
  music: "Muzyka",
  game: "Gra",
  comic: "Komiks",
  other: "Inne",
};

interface CommunitySearchDialogProps {
  initialQuery: string;
  onSelect: (item: CommunityItem) => void;
  onClose: () => void;
}

/** Pop-up search over other users' items, shown when recognition and catalogs find nothing. */
export function CommunitySearchDialog({ initialQuery, onSelect, onClose }: CommunitySearchDialogProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<CommunityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => Boolean(initialQuery.trim()));

  const showResults = (data: CommunityItem[] | null, searchError: string | null) => {
    setLoading(false);
    setResults(data ?? []);
    setError(searchError);
  };

  const runSearch = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    const { data, error: searchError } = await searchCommunityItems(text);
    showResults(data, searchError);
  };

  // Search right away for the text read from the cover; later searches are explicit.
  useEffect(() => {
    if (!initialQuery.trim()) return;
    let active = true;
    void searchCommunityItems(initialQuery).then(({ data, error: searchError }) => {
      if (active) showResults(data, searchError);
    });
    return () => {
      active = false;
    };
  }, [initialQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-search-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[80vh] flex flex-col gap-3 p-4 rounded-3xl bg-s1 border border-s2 shadow-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="community-search-title" className="text-sm font-bold text-tx">
              Szukaj we wpisach innych użytkowników
            </h3>
            <p className="text-xs text-mu mt-0.5">
              Nie udało się rozpoznać okładki. Wpisz tytuł i wybierz istniejący wpis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="text-mu hover:text-tx text-lg leading-none px-1"
          >
            ×
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="search"
            aria-label="Tytuł lub twórca"
            placeholder="Tytuł lub twórca"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch(query);
              }
            }}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-bg border border-s2 text-xs text-tx placeholder:text-mu outline-none focus:border-ac"
          />
          <button
            type="button"
            disabled={loading || !query.trim()}
            onClick={() => void runSearch(query)}
            className="px-3 py-2 rounded-xl bg-ac/15 border border-ac/40 text-ac font-medium text-xs transition-all disabled:opacity-50"
          >
            Szukaj w kolekcjach
          </button>
        </div>

        <div className="overflow-y-auto -mx-1 px-1">
          {loading ? (
            <p className="text-xs text-mu py-2">Szukam...</p>
          ) : error ? (
            <p className="text-xs text-red-400 py-2">{error}</p>
          ) : results && results.length === 0 ? (
            <p className="text-xs text-mu py-2">
              Brak wpisów dla „{query.trim()}”. Zamknij okno i uzupełnij dane ręcznie.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {results?.map((item, index) => (
                <li key={`${item.title}-${item.artist_creator}-${item.category}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl bg-bg border border-s2 hover:border-ac text-left transition-all"
                  >
                    <div className="w-10 h-14 shrink-0 rounded-md overflow-hidden bg-s2 flex items-center justify-center text-sm font-bold text-mu">
                      {item.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        item.title.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-tx truncate">{item.title}</p>
                      {item.artist_creator && (
                        <p className="text-xs text-mu truncate">{item.artist_creator}</p>
                      )}
                      <p className="text-[10px] text-mu">
                        {CATEGORY_LABELS[item.category] || item.category}
                        {item.subcategory ? ` · ${item.subcategory}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
