"use client";

import { Icon } from "@/components/ui/primitives";

export type Tab = "home" | "search" | "add" | "share" | "profile";

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "search", label: "Szukaj", icon: "search" },
  { id: "add", label: "Dodaj", icon: "add" },
  { id: "share", label: "Udostępnij", icon: "ios_share" },
  { id: "profile", label: "Profil", icon: "person" },
];

export function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav
      aria-label="Nawigacja"
      className="fixed left-0 right-0 bottom-0 z-[25] mx-auto max-w-[480px] grid grid-cols-5 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] min-h-[88px] border-t border-s2 backdrop-blur-[20px] bg-[color-mix(in_oklch,var(--bg)_86%,transparent)]"
    >
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-current={on ? "page" : undefined}
            className="flex flex-col items-center justify-start gap-[3px] text-[10.5px] font-medium"
            style={{ color: on ? "var(--tx)" : "var(--mu)" }}
          >
            {t.id === "add" ? (
              <span
                aria-hidden="true"
                className="ms w-[62px] h-[62px] -mt-[34px] -mb-px rounded-full border-[5px] border-bg gradient-ac text-act flex items-center justify-center shadow-[0_10px_26px_-6px_var(--ac)]"
                style={{ fontSize: 32 }}
              >
                add
              </span>
            ) : (
              <Icon name={t.icon} size={27} fill={on} style={{ height: 28 }} />
            )}
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
