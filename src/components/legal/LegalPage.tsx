"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/primitives";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { useI18n } from "@/lib/i18n/locale";
import { legalText, type LegalDocument } from "@/lib/legal/content";

type Texts = Parameters<typeof legalText>[0];

/** A public, text-only page (privacy policy, account deletion) in the UI language; no sign-in needed. */
export function LegalPage({ texts }: { texts: Texts }) {
  const { locale, t } = useI18n();
  const doc: LegalDocument = legalText(texts, locale);

  return (
    <main className="flex min-h-screen flex-col items-center bg-bg text-tx">
      <header className="w-full max-w-xl flex items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top))] pb-2">
        <Link href="/" aria-label="Katalog">
          <Logo size={26} />
        </Link>
        <LanguageSwitch />
      </header>

      <article className="w-full max-w-xl px-5 pb-16 pt-4">
        <h1 className="text-[28px] font-extrabold tracking-[-.03em]">{doc.title}</h1>
        <p className="text-[13px] text-mu mt-1">{doc.updatedLabel}</p>

        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-7">
            <h2 className="text-lg font-bold tracking-[-.02em] mb-2">{section.heading}</h2>
            {section.items && (
              <ul className="list-disc pl-5 flex flex-col gap-1.5 text-[14.5px] leading-[1.55] text-tx/90">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.paragraphs?.map((text) => (
              <p key={text} className="text-[14.5px] leading-[1.55] text-tx/90 mt-2">
                {text}
              </p>
            ))}
          </section>
        ))}

        <nav className="mt-10 flex gap-4 text-sm text-mu underline underline-offset-2">
          <Link href="/privacy">{t("legal.privacy")}</Link>
          <Link href="/delete-account">{t("legal.deleteAccount")}</Link>
          <Link href="/">{t("legal.backToApp")}</Link>
        </nav>
      </article>
    </main>
  );
}
