"use client";

import { useEffect } from "react";
import { restoreLocale } from "@/lib/i18n/locale";

/** After hydration, switches the UI (and <html lang>) to the language picked on this device. */
export function LocaleSync() {
  useEffect(() => {
    restoreLocale();
  }, []);
  return null;
}
