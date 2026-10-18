"use client";

import { useState } from "react";
import type { Item } from "@/types/database";
import { CATEGORIES, collectionSummary, initialOf, type CategoryDef } from "@/lib/items/display";
import { DISPLAY_NAME_MAX_LENGTH, updateDisplayName } from "@/lib/profiles/api";
import { Cover, Icon } from "@/components/ui/primitives";

interface ProfileScreenProps {
  name: string;
  items: Item[];
  /** Categories the user keeps in the catalog. */
  categories?: CategoryDef[];
  onOpen: (item: Item) => void;
  onNameSaved: (name: string) => void;
  onSignOut: () => void;
  onEditTypes: () => void;
  onToast: (message: string) => void;
}

export function ProfileScreen({
  name,
  items,
  categories = CATEGORIES,
  onOpen,
  onNameSaved,
  onSignOut,
  onEditTypes,
  onToast,
}: ProfileScreenProps) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [sortNew, setSortNew] = useState(true);

  const stats = [{ value: "all", label: "Wszystko", color: "var(--ac)" }, ...categories].map((c) => ({
    ...c,
    count: c.value === "all" ? items.length : items.filter((i) => i.category === c.value).length,
  }));
  const active = stats.find((s) => s.value === category);
  let shown = items.filter((i) => category === "all" || i.category === category);
  if (!sortNew) shown = shown.slice().sort((a, b) => a.title.localeCompare(b.title, "pl"));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { success, error: saveError } = await updateDisplayName(draft);
    if (!success) {
      setError(saveError);
      return;
    }
    setError(null);
    setEditing(false);
    onNameSaved(draft.trim());
    onToast("Zapisano");
  };

  return (
    <div className="relative pb-[120px]">
      <div className="relative h-[60px] mt-[env(safe-area-inset-top)] flex items-center justify-center">
        <h1 className="text-base font-bold">Profil</h1>
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-label="Więcej opcji"
          aria-expanded={menu}
          className="absolute right-3.5 top-2 w-11 h-11 rounded-full text-tx flex items-center justify-center p-0"
        >
          <Icon name="more_horiz" size={28} />
        </button>
      </div>

      {menu && (
        <>
          <div onClick={() => setMenu(false)} className="fixed inset-0 z-20" />
          <div role="menu" className="absolute right-4 top-[60px] z-[21] min-w-[190px] p-1.5 rounded-2xl bg-s1 border border-s2 shadow-[0_20px_40px_-10px_rgba(0,0,0,.7)]">
            <button
              type="button"
              role="menuitem"
              onClick={onEditTypes}
              className="w-full flex items-center gap-2.5 h-[46px] px-3 rounded-[11px] text-tx text-[15px] font-semibold hover:bg-white/5"
            >
              <Icon name="category" size={21} />
              Typy w katalogu
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onSignOut}
              className="w-full flex items-center gap-2.5 h-[46px] px-3 rounded-[11px] text-rose-400 text-[15px] font-semibold hover:bg-rose-400/10"
            >
              <Icon name="logout" size={21} />
              Wyloguj
            </button>
          </div>
        </>
      )}

      <div className="flex flex-col items-center px-5 pt-1.5">
        <div className="w-[108px] h-[108px] rounded-full p-[3px] gradient-ac">
          <div
            aria-hidden="true"
            className="w-full h-full rounded-full border-[3px] border-bg flex items-center justify-center text-[40px] font-extrabold"
            style={{ background: "repeating-linear-gradient(45deg,var(--s1) 0 6px,var(--s2) 6px 12px)" }}
          >
            {initialOf(name) || "K"}
          </div>
        </div>

        {editing ? (
          <form onSubmit={save} className="flex items-center gap-2 mt-3 w-full max-w-[280px]">
            <input
              aria-label="Nazwa wyświetlana"
              autoFocus
              value={draft}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              className="flex-1 min-w-0 h-11 rounded-[13px] bg-s1 border border-ac px-3.5 text-tx text-[17px] font-semibold outline-none text-center"
            />
            <button
              type="submit"
              aria-label="Zapisz nazwę"
              className="w-11 h-11 flex-none rounded-[13px] bg-ac text-act flex items-center justify-center p-0"
            >
              <Icon name="check" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-1.5 mt-3.5 pl-[30px]">
            <div className="text-[22px] font-extrabold tracking-[-.03em]">{name || "Bez nazwy"}</div>
            <button
              type="button"
              onClick={() => {
                setDraft(name);
                setEditing(true);
              }}
              aria-label="Edytuj nazwę"
              className="w-[30px] h-[30px] rounded-full text-mu flex items-center justify-center p-0"
            >
              <Icon name="edit" size={19} />
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[13px] text-rose-400 mt-1">
            {error}
          </p>
        )}
        <div className="text-[13.5px] text-mu mt-[3px]">{collectionSummary(items)}</div>
      </div>

      <div role="tablist" aria-label="Statystyki kolekcji" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }} className="grid mx-3 mt-[22px] border-b border-s2">
        {stats.map((s) => {
          const on = category === s.value;
          return (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setCategory(s.value)}
              className="relative pt-1 pb-3 flex flex-col items-center gap-[3px] transition-colors"
              style={{ color: on ? "var(--tx)" : "var(--mu)" }}
            >
              <span className="text-xl font-extrabold tracking-[-.02em]">{s.count}</span>
              <span className="text-xs font-medium">{s.label}</span>
              <span
                className="absolute left-[22%] right-[22%] -bottom-px h-[3px] rounded-sm transition-all duration-300"
                style={{ background: s.color, opacity: on ? 1 : 0, transform: `scaleX(${on ? 1 : 0.3})` }}
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <div className="text-[13px] text-mu">
          {category === "all" ? "Cała kolekcja" : active?.label} · {shown.length}
        </div>
        <button
          type="button"
          onClick={() => setSortNew((v) => !v)}
          className="flex items-center gap-1 text-tx text-[13px] font-medium p-0"
        >
          <Icon name="swap_vert" size={18} />
          {sortNew ? "Najnowsze" : "A–Z"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-0.5 pt-0.5">
        {shown.map((it) => (
          <button key={it.id} type="button" onClick={() => onOpen(it)} aria-label={it.title} className="block">
            <Cover title={it.title} seed={it.id} src={it.cover_url} letterSize={38} showTitle className="aspect-[2/3]" />
          </button>
        ))}
      </div>
    </div>
  );
}
