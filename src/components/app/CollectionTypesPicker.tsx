"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/items/display";
import { Icon, Logo } from "@/components/ui/primitives";

interface CollectionTypesPickerProps {
  initial: string[];
  /** Resolves to null on success, or the error message to show. */
  onSave: (types: string[]) => Promise<string | null>;
  /** Shown as a back button when changing the choice from the profile; absent on first login. */
  onCancel?: () => void;
}

/** Which item categories the user keeps in the catalog — asked on first login, changed from the profile. */
export function CollectionTypesPicker({ initial, onSave, onCancel }: CollectionTypesPickerProps) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (value: string) => {
    setError(null);
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const save = async () => {
    setSaving(true);
    // Saved in the app's category order, whatever order they were tapped in.
    const saveError = await onSave(CATEGORIES.map((c) => c.value).filter((v) => selected.includes(v)));
    setSaving(false);
    if (saveError) setError(saveError);
  };

  return (
    <div className="relative w-full max-w-[480px] mx-auto min-h-dvh flex flex-col px-5 pt-[max(12px,env(safe-area-inset-top))] pb-10">
      <div className="relative h-[60px] flex items-center justify-center">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Wróć"
            className="absolute left-0 top-2 w-11 h-11 rounded-full text-tx flex items-center justify-center p-0"
          >
            <Icon name="arrow_back_ios" size={20} style={{ marginLeft: 5 }} />
          </button>
        ) : null}
        <Logo size={26} />
      </div>

      <h1 className="text-[28px] font-extrabold tracking-[-.035em] mt-6">Co kolekcjonujesz?</h1>
      <p className="text-[14px] text-mu mt-1.5">
        Wybierz typy pozycji w katalogu. Możesz to zmienić w profilu — nic nie zostanie usunięte.
      </p>

      <div role="group" aria-label="Typy pozycji" className="grid grid-cols-2 gap-3 mt-6">
        {CATEGORIES.map((c) => {
          const on = selected.includes(c.value);
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.value)}
              className="h-[84px] rounded-[18px] border-[1.5px] bg-s1 flex items-center justify-between px-4 text-left text-[16px] font-bold transition-colors"
              style={{ borderColor: on ? c.color : "var(--s2)", color: on ? c.color : "var(--tx)" }}
            >
              {c.label}
              {on && <Icon name="check" size={22} />}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-rose-400 mt-3">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={selected.length === 0 || saving}
        className="mt-8 h-[52px] rounded-full bg-ac text-act font-semibold text-[16px] disabled:opacity-40"
      >
        {saving ? "Zapisywanie..." : "Zapisz"}
      </button>
    </div>
  );
}
