"use client";

import { Icon } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/translate";

export type Tab = "home" | "search" | "add" | "share" | "profile";

const TABS: Array<{ id: Tab; label: MessageKey; icon: string }> = [
  { id: "home", label: "nav.home", icon: "home" },
  { id: "search", label: "nav.search", icon: "search" },
  { id: "add", label: "nav.add", icon: "add" },
  { id: "share", label: "nav.share", icon: "ios_share" },
  { id: "profile", label: "nav.profile", icon: "person" },
];

export function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("nav.label")}
      className="fixed left-0 right-0 bottom-0 z-[25] mx-auto max-w-[480px] grid grid-cols-5 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] min-h-[88px] border-t border-s2 backdrop-blur-[20px] bg-[color-mix(in_oklch,var(--bg)_86%,transparent)]"
    >
      {TABS.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={on ? "page" : undefined}
            className="flex flex-col items-center justify-start gap-[3px] text-[10.5px] font-medium"
            style={{ color: on ? "var(--tx)" : "var(--mu)" }}
          >
            {tab.id === "add" ? (
              <span
                aria-hidden="true"
                className="ms w-[62px] h-[62px] -mt-[34px] -mb-px rounded-full border-[5px] border-bg gradient-ac text-act flex items-center justify-center shadow-[0_10px_26px_-6px_var(--ac)]"
                style={{ fontSize: 32 }}
              >
                add
              </span>
            ) : (
              <Icon name={tab.icon} size={27} fill={on} style={{ height: 28 }} />
            )}
            {t(tab.label)}
          </button>
        );
      })}
    </nav>
  );
}
