"use client";

import { useState } from "react";
import type { Item } from "@/types/database";
import { CATEGORIES, categoryDef, matchesQuery, normalizeForSearch, pillStyle, plural } from "@/lib/items/display";
import { Chip, Cover, Icon } from "@/components/ui/primitives";

interface SearchScreenProps {
  items: Item[];
  onOpen: (item: Item) => void;
}

export function SearchScreen({ items, onOpen }: SearchScreenProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const nq = normalizeForSearch(query.trim());
  const byQuery = items.filter((i) => matchesQuery(i, nq));
  const results = byQuery.filter((i) => category === "all" || i.category === category);
  const chips = [{ value: "all", label: "Wszystkie" }, ...CATEGORIES].map((c) => ({
    ...c,
    count: c.value === "all" ? byQuery.length : byQuery.filter((i) => i.category === c.value).length,
  }));

  return (
    <div className="pb-[120px]">
      <div className="sticky top-0 z-[5] px-5 pt-[max(12px,env(safe-area-inset-top))] pb-3 flex flex-col gap-3.5 backdrop-blur-[16px] bg-[color-mix(in_oklch,var(--bg)_92%,transparent)]">
        <h1 className="text-[30px] font-extrabold tracking-[-.04em] pt-2">Szukaj</h1>
        <div className="flex items-center gap-2.5 h-[50px] px-3.5 rounded-[15px] bg-s1 border border-s2">
          <Icon name="search" className="text-mu" />
          <input
            type="search"
            aria-label="Szukaj w kolekcji"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj po tytule lub twórcy..."
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-tx text-base [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Wyczyść"
              className="w-6 h-6 rounded-full bg-s2 text-tx flex items-center justify-center p-0"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <div role="tablist" aria-label="Kategorie" className="flex gap-2 overflow-x-auto scrollbar-none -mx-5 px-5">
          {chips.map((c) => (
            <Chip key={c.value} role="tab" active={category === c.value} onClick={() => setCategory(c.value)}>
              {c.label}
              <span className="text-[11.5px] font-semibold opacity-60">{c.count}</span>
            </Chip>
          ))}
        </div>
        <div className="text-[13px] text-mu">
          <span className="text-tx font-bold">{results.length}</span>{" "}
          {plural(results.length, ["wynik", "wyniki", "wyników"])}
        </div>
      </div>

      {results.length > 0 ? (
        <div data-testid="item-grid" className="grid grid-cols-3 gap-x-3 gap-y-4 px-5 pt-1.5">
          {results.map((it) => (
            <article key={it.id} data-testid={`item-card-${it.id}`} className="flex flex-col gap-1.5 min-w-0">
              <button type="button" onClick={() => onOpen(it)} aria-label={it.title} className="block text-left">
                <Cover
                  title={it.title}
                  seed={it.id}
                  src={it.cover_url}
                  alt={it.title}
                  letterSize={40}
                  className="aspect-[2/3] rounded-[10px] shadow-[0_0_0_1px_rgba(255,255,255,.07)]"
                >
                  <span
                    className="absolute top-1.5 left-1.5 text-[10px] font-semibold px-[7px] py-0.5 rounded-full border backdrop-blur-sm"
                    style={pillStyle(it.category)}
                  >
                    {categoryDef(it.category).one}
                  </span>
                </Cover>
              </button>
              <div className="min-w-0">
                <h3 className="text-[12.5px] font-semibold truncate">{it.title}</h3>
                {it.artist_creator && <p className="text-[11.5px] text-mu truncate">{it.artist_creator}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mx-5 mt-[30px] px-5 py-11 rounded-[18px] bg-s1 border border-s2 text-center">
          <p className="text-[15px] font-semibold">
            {query.trim() ? `Brak wyników dla „${query.trim()}”` : "Brak pozycji"}
          </p>
          <p className="text-[13px] text-mu mt-1">Spróbuj innej frazy lub kategorii.</p>
        </div>
      )}
    </div>
  );
}
