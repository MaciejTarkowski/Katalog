"use client";

import { useI18n } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/translate";

/** Translated text for server components (pages, Suspense fallbacks), which cannot read the UI language. */
export function T({ k }: { k: MessageKey }) {
  const { t } = useI18n();
  return <>{t(k)}</>;
}
