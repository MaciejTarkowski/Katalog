"use client";

import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";
import { setLocale, useI18n } from "@/lib/i18n/locale";

/** Compact EN / PL / DE switch for screens without a profile (welcome, shared collection). */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
  return (
    <div role="group" aria-label={t("profile.language")} className={`flex gap-1 ${className}`}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={locale === code}
          aria-label={LOCALE_NAMES[code]}
          lang={code}
          onClick={() => setLocale(code)}
          className="h-8 px-2.5 rounded-[9px] text-[12px] font-bold uppercase backdrop-blur-md transition-colors"
          style={
            locale === code
              ? { background: "var(--ac)", color: "var(--acT)" }
              : { background: "rgba(255,255,255,.07)", color: "var(--mu)" }
          }
        >
          {code}
        </button>
      ))}
    </div>
  );
}
