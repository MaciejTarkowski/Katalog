"use client";

import { Item } from "@/types/database";
import { ItemCard } from "./ItemCard";

interface ItemListProps {
  items: Item[];
  isLoading?: boolean;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onDeleteItem?: (id: string) => void;
}

const CATEGORY_TABS = [
  { value: "all", label: "Wszystkie" },
  { value: "book", label: "Książki" },
  { value: "music", label: "Muzyka" },
  { value: "game", label: "Gry" },
  { value: "comic", label: "Komiksy" },
  { value: "other", label: "Inne" },
];

export function ItemList({
  items,
  isLoading,
  selectedCategory,
  onSelectCategory,
  onDeleteItem,
}: ItemListProps) {
  const filteredItems =
    selectedCategory === "all"
      ? items
      : items.filter((item) => item.category === selectedCategory);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Category filter tabs */}
      <div
        role="tablist"
        aria-label="Kategorie"
        className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-slate-950/90 backdrop-blur flex items-center gap-1.5 overflow-x-auto scrollbar-none"
      >
        {CATEGORY_TABS.map((tab) => {
          const isActive = selectedCategory === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectCategory(tab.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Item count */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Przedmioty w kolekcji:</span>
        <span className="font-semibold text-slate-200">{filteredItems.length}</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-xl bg-slate-900/60 border border-slate-800/60 animate-pulse"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/40 border border-slate-800/80">
          <p className="text-sm font-semibold text-slate-300">Pusta kolekcja</p>
          <p className="text-xs text-slate-500 mt-1">
            Brak elementów w wybranej kategorii. Dodaj swój pierwszy przedmiot!
          </p>
        </div>
      ) : selectedCategory === "all" ? (
        <div className="flex flex-col gap-6">
          {CATEGORY_TABS.slice(1).map((tab) => {
            const rowItems = filteredItems.filter((item) => item.category === tab.value);
            if (!rowItems.length) return null;
            return (
              <section key={tab.value} aria-label={tab.label} className="flex flex-col gap-2">
                <h2 className="text-sm font-bold text-white px-1">{tab.label}</h2>
                <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory py-2 -mx-1 px-1 scrollbar-none">
                  {rowItems.map((item) => (
                    <div key={item.id} className="w-32 sm:w-40 flex-shrink-0 snap-start">
                      <ItemCard item={item} onDelete={onDeleteItem} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div
          data-testid="item-grid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
        >
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} onDelete={onDeleteItem} />
          ))}
        </div>
      )}
    </div>
  );
}
