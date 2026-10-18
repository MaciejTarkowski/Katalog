import { Suspense } from "react";
import { Logo } from "@/components/ui/primitives";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { T } from "@/components/ui/T";
import { ShareContent } from "./ShareContent";

interface PageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default function SharePage({ params }: PageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-bg text-tx">
      <header className="w-full max-w-xl flex items-center justify-between px-5 pt-[max(20px,env(safe-area-inset-top))] pb-2">
        <h1 className="sr-only">Katalog</h1>
        <Logo size={26} />
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/15 bg-white/[.06] text-mu font-semibold">
            <T k="public.tag" />
          </span>
        </div>
      </header>

      <section className="w-full max-w-xl flex flex-col">
        <Suspense fallback={<div className="text-sm text-mu px-5 py-8"><T k="public.loading" /></div>}>
          <ShareContent params={params} />
        </Suspense>
      </section>

      <footer className="w-full max-w-xl text-center px-5 pb-6 text-xs text-mu">
        <T k="public.footer" />
      </footer>
    </main>
  );
}
