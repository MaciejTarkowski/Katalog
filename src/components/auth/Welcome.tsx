"use client";

import { useCallback, useEffect, useState } from "react";
import { Logo, Sheet } from "@/components/ui/primitives";
import { tileBackground } from "@/lib/items/display";
import { AuthForm } from "./AuthForm";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { useI18n } from "@/lib/i18n/locale";

const book = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
const game = (steamAppId: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`;
const album = (releaseGroupMbid: string) =>
  `https://coverartarchive.org/release-group/${releaseGroupMbid}/front-250`;

/** Well-known books, games and albums for the welcome mosaic, interleaved so every column mixes them. */
const MOSAIC_COVERS = [
  book("9780441172719"), // Dune
  game(292030), // The Witcher 3
  album("f5093c06-23e3-404f-aeaa-40f72885ee3a"), // The Dark Side of the Moon
  book("9780547928227"), // The Hobbit
  game(1174180), // Red Dead Redemption 2
  album("9162580e-5df4-32de-80cc-f45a8d8a9b1d"), // Abbey Road
  book("9780451524935"), // 1984
  game(1245620), // Elden Ring
  album("f32fab67-77dd-3937-addc-9062e28e4c37"), // Thriller
  book("9780316029186"), // The Last Wish
  game(271590), // GTA V
  album("1b022e01-4da6-387b-8658-8678046e4cef"), // Nevermind
  book("9781451673319"), // Fahrenheit 451
  game(1593500), // God of War
  album("416bb5e5-c7d1-3977-8fd7-7c9daf6c2be6"), // Rumours
  book("9780553418026"), // The Martian
  game(1091500), // Cyberpunk 2077
  album("d3bc1a64-7561-3787-b680-0003aa50f8f1"), // Back in Black
];

const INTRO_KEY = "katalog-intro-seen";

function Mosaic() {
  const cols = [0, 1, 2, 3].map((ci) => {
    const list = MOSAIC_COVERS.filter((_, i) => i % 4 === ci).concat(
      MOSAIC_COVERS.filter((_, i) => (i + 1) % 4 === ci).slice(0, 2)
    );
    return (
      <div
        key={ci}
        className="flex flex-col gap-3"
        style={{
          marginTop: ci % 2 ? -60 : 0,
          animation: `kDrift ${46 + ci * 7}s linear infinite ${ci % 2 ? "reverse" : ""}`,
        }}
      >
        {list.concat(list).map((src, i) => (
          <div
            key={i}
            className="w-28 h-[168px] flex-none rounded-[10px] overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,.06)]"
            style={{ background: tileBackground(src) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              onError={(e) => (e.currentTarget.style.opacity = "0")}
              className="w-full h-full object-cover block"
            />
          </div>
        ))}
      </div>
    );
  });
  return (
    <div aria-hidden="true" className="absolute -top-[120px] -left-[70px] flex gap-3 origin-top" style={{ transform: "rotate(-9deg)" }}>
      {cols}
    </div>
  );
}

/** Logo intro: a record spins in, the square slides off and a hole opens onto the app. */
function Intro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3450);
    return () => clearTimeout(t);
  }, [onDone]);

  const an = (name: string) => `${name} 3.4s cubic-bezier(.45,0,.2,1) both`;
  return (
    <div
      data-testid="intro"
      onClick={onDone}
      className="fixed inset-0 z-[58] overflow-hidden cursor-pointer"
      aria-hidden="true"
    >
      <div
        className="absolute w-0 h-0 rounded-full"
        style={{
          left: "50%",
          top: "calc(50% - 30px)",
          transform: "translate(-50%,-50%)",
          boxShadow: "0 0 0 2400px #000",
          animation: an("kCH"),
        }}
      />
      <div className="absolute left-1/2 top-1/2 w-[120px] h-[120px]" style={{ margin: "-90px 0 0 -60px" }}>
        <span
          className="absolute rounded-full bg-ac"
          style={{
            left: -348,
            top: -360,
            width: 840,
            height: 840,
            WebkitMaskImage: "radial-gradient(circle, transparent 0 80px, #000 86px)",
            maskImage: "radial-gradient(circle, transparent 0 80px, #000 86px)",
            animation: an("kC2"),
          }}
        >
          {[150, 230, 300].map((i) => (
            <span key={i} className="absolute rounded-full" style={{ inset: i, border: "7px solid rgba(0,0,0,.16)" }} />
          ))}
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent, rgba(255,255,255,.22) 12%, transparent 26%, transparent 50%, rgba(255,255,255,.16) 62%, transparent 76%)",
            }}
          />
        </span>
        <span className="absolute left-0 top-3.5 w-[92px] h-[92px] rounded-[11px] bg-white" style={{ animation: an("kC1") }} />
      </div>
      <div
        className="absolute left-0 right-0 text-center text-white text-[40px] font-extrabold"
        style={{ top: "calc(50% + 54px)", animation: an("kWord") }}
      >
        katalog
      </div>
    </div>
  );
}

export function Welcome({ onAuthSuccess }: { onAuthSuccess?: (message: string) => void }) {
  const { t } = useI18n();
  const [sheet, setSheet] = useState<"login" | "signup" | null>(null);
  // Last opened mode, kept while the sheet slides out.
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showIntro, setShowIntro] = useState(false);
  const hideIntro = useCallback(() => {
    setShowIntro(false);
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      // Private mode: the intro may play again, which is harmless.
    }
  }, []);
  const open = (next: "login" | "signup") => {
    setMode(next);
    setSheet(next);
  };

  // Play the intro once per browser session (marked as seen when it ends).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(INTRO_KEY)) return;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only
    setShowIntro(true);
  }, []);

  return (
    <div className="fixed inset-0 overflow-clip bg-bg">
      <div className="absolute inset-0 mx-auto max-w-[480px] overflow-clip">
        <Mosaic />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg,color-mix(in oklch,var(--bg) 35%,transparent) 0%,color-mix(in oklch,var(--bg) 60%,transparent) 34%,var(--bg) 62%)",
          }}
        />
        <div className="absolute left-0 right-0 bottom-0 px-7 pb-[max(54px,env(safe-area-inset-bottom))] flex flex-col gap-[22px]">
          <div className="flex items-center justify-between">
            <Logo size={36} />
            <LanguageSwitch />
          </div>
          <h1 className="m-0 text-[40px] leading-[1.03] font-extrabold tracking-[-.04em] text-balance">
            {t("welcome.title")}
          </h1>
          <p className="-mt-1.5 text-base leading-[1.45] text-mu text-pretty">
            {t("welcome.text")}
          </p>
          <div className="flex flex-col gap-3 mt-1.5">
            <button
              type="button"
              onClick={() => open("signup")}
              className="h-14 rounded-2xl bg-ac text-act text-[17px] font-semibold shadow-[0_14px_34px_-12px_var(--ac)]"
            >
              {t("auth.signUp")}
            </button>
            <button
              type="button"
              onClick={() => open("login")}
              className="h-14 rounded-2xl bg-white/[.07] border border-white/15 text-tx text-[17px] font-semibold backdrop-blur-md"
            >
              {t("auth.logIn")}
            </button>
          </div>
        </div>
      </div>

      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        label={mode === "signup" ? t("welcome.signupSheet") : t("welcome.loginSheet")}
        className="px-6 pb-[max(44px,env(safe-area-inset-bottom))]"
      >
        <AuthForm key={mode} initialMode={mode} onSuccess={onAuthSuccess} />
      </Sheet>

      {showIntro && <Intro onDone={hideIntro} />}
    </div>
  );
}
