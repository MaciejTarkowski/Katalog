"use client";

import { useEffect, useRef, useState } from "react";
import type { Item } from "@/types/database";
import { CATEGORIES, OTHER_CATEGORY, addedAgo, categoryDef } from "@/lib/items/display";
import { Chip, Cover, Icon, Logo } from "@/components/ui/primitives";

interface HomeScreenProps {
  items: Item[];
  isLoading?: boolean;
  userInitial: string;
  onOpen: (item: Item) => void;
  onProfile: () => void;
  onAdd: () => void;
}

const HERO_COUNT = 5;
const HERO_INTERVAL_MS = 4500;
const HERO_TICK_MS = 500;

/** Cover tile with title + creator below, used in horizontal rows. */
export function RowCard({ item, onOpen, width = 116 }: { item: Item; onOpen: (item: Item) => void; width?: number }) {
  return (
    <article data-testid={`item-card-${item.id}`} className="flex-none flex flex-col gap-[7px] snap-start" style={{ width }}>
      <button type="button" onClick={() => onOpen(item)} aria-label={item.title} className="block text-left">
        <Cover
          title={item.title}
          seed={item.id}
          src={item.cover_url}
          alt={item.title}
          showTitle
          className="rounded-[10px] shadow-[0_0_0_1px_rgba(255,255,255,.07)]"
          style={{ width, height: width * 1.5 }}
        />
      </button>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold truncate">{item.title}</h3>
        {item.artist_creator && <p className="text-xs text-mu truncate">{item.artist_creator}</p>}
      </div>
    </article>
  );
}

export function HomeScreen({ items, isLoading, userInitial, onOpen, onProfile, onAdd }: HomeScreenProps) {
  const [category, setCategory] = useState("all");
  const [heroIdx, setHeroIdx] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  const hero = items.filter((i) => i.cover_url).slice(0, HERO_COUNT);
  const showHero = category === "all" && hero.length > 0;
  const hasOther = items.some((i) => !CATEGORIES.some((c) => c.value === i.category));
  const tabs = hasOther ? [...CATEGORIES, OTHER_CATEGORY] : CATEGORIES;
  const rows = tabs
    .filter((c) => category === "all" || category === c.value)
    .map((c) => ({
      ...c,
      items: items.filter((i) =>
        c.value === "other" ? !CATEGORIES.some((k) => k.value === i.category) : i.category === c.value
      ),
    }))
    .filter((r) => r.items.length > 0);

  // Cached instead of read from the DOM inside the scroll handler: `clientWidth` forces a
  // synchronous layout reflow, and reading it on every scroll event (which can fire on nearly
  // every frame of a touch drag) is what made swiping the carousel stutter/freeze.
  const widthRef = useRef(0);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const update = () => (widthRef.current = el.clientWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [showHero]);

  const scrollHeroTo = (i: number) => {
    const el = heroRef.current;
    if (el) el.scrollTo({ left: i * (widthRef.current || el.clientWidth), behavior: "smooth" });
  };

  // Auto-advance the hero carousel, but never while (or right after) the user scrolls it by any means
  // (touch, wheel/trackpad, keyboard): a programmatic scroll mid-gesture would undo it or strand the
  // carousel between two slides. Our own smooth scrolls are told apart so they don't count as activity.
  const touching = useRef(false);
  const idleTicks = useRef(0);
  const programmatic = useRef(false);
  const programmaticTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const markTouch = (active: boolean) => {
    touching.current = active;
    idleTicks.current = 0;
  };
  const markActivity = () => {
    idleTicks.current = 0;
  };

  const scrollRaf = useRef<number | undefined>(undefined);
  useEffect(() => () => {
    if (scrollRaf.current !== undefined) cancelAnimationFrame(scrollRaf.current);
  }, []);

  useEffect(() => {
    if (!showHero || hero.length < 2) return;
    idleTicks.current = 0;
    const t = setInterval(() => {
      const el = heroRef.current;
      if (!el || !el.clientWidth || touching.current) return;
      if (++idleTicks.current < HERO_INTERVAL_MS / HERO_TICK_MS) return;
      idleTicks.current = 0;
      const nearest = Math.round(el.scrollLeft / el.clientWidth);
      const aligned = Math.abs(el.scrollLeft - nearest * el.clientWidth) <= 2;
      const target = aligned ? (nearest + 1) % hero.length : nearest;
      programmatic.current = true;
      clearTimeout(programmaticTimer.current);
      programmaticTimer.current = setTimeout(() => (programmatic.current = false), 800);
      el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    }, HERO_TICK_MS);
    return () => {
      clearInterval(t);
      clearTimeout(programmaticTimer.current);
    };
  }, [showHero, hero.length]);

  return (
    <div className="relative pb-[120px]">
      {showHero && (
        <div aria-hidden="true" className="absolute top-0 left-0 right-0 h-[660px] overflow-hidden pointer-events-none">
          {hero.map((h, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={h.id}
              src={h.cover_url!}
              alt=""
              onError={(e) => (e.currentTarget.style.display = "none")}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: "blur(40px) saturate(1.5)",
                transform: "scale(1.4)",
                opacity: i === heroIdx ? 1 : 0,
                transition: "opacity .9s ease",
              }}
            />
          ))}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg,color-mix(in oklch,var(--bg) 50%,transparent) 0%,color-mix(in oklch,var(--bg) 30%,transparent) 45%,var(--bg) 100%)",
            }}
          />
        </div>
      )}

      <div className="relative pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between px-5 pt-2.5">
          <Logo size={26} />
          <button
            type="button"
            onClick={onProfile}
            aria-label="Otwórz profil"
            className="w-[34px] h-[34px] rounded-full border-[1.5px] border-white/25 bg-s2 text-tx text-sm font-bold"
          >
            {userInitial}
          </button>
        </div>

        <div role="tablist" aria-label="Kategorie" className="flex gap-2 overflow-x-auto scrollbar-none px-5 pt-4 pb-[18px]">
          <Chip role="tab" active={category === "all"} onClick={() => setCategory("all")}>
            Wszystkie
          </Chip>
          {tabs.map((c) => (
            <Chip key={c.value} role="tab" active={category === c.value} onClick={() => { setCategory(c.value); setHeroIdx(0); }}>
              {c.label}
            </Chip>
          ))}
        </div>

        {showHero && (
          <>
            <div
              ref={heroRef}
              onTouchStart={() => markTouch(true)}
              onTouchEnd={() => markTouch(false)}
              onTouchCancel={() => markTouch(false)}
              onWheel={markActivity}
              onKeyDown={markActivity}
              onScroll={(e) => {
                if (!programmatic.current) markActivity();
                // Scroll events fire on nearly every frame of a touch drag — batch the index
                // update to at most once per frame instead of a setState per event.
                const el = e.currentTarget;
                if (scrollRaf.current !== undefined) return;
                scrollRaf.current = requestAnimationFrame(() => {
                  scrollRaf.current = undefined;
                  const width = widthRef.current || el.clientWidth;
                  const i = Math.round(el.scrollLeft / (width || 1));
                  setHeroIdx((prev) => (prev === i ? prev : i));
                });
              }}
              className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
            >
              {hero.map((h) => (
                <div key={h.id} className="flex-none w-full snap-center flex flex-col items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpen(h)}
                    aria-label={h.title}
                    className="rounded-[14px] overflow-hidden shadow-[0_34px_60px_-20px_rgba(0,0,0,.85),0_0_0_1px_rgba(255,255,255,.08)]"
                  >
                    <Cover title={h.title} seed={h.id} src={h.cover_url} letterSize={84} style={{ width: 204, height: 306 }} />
                  </button>
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-[10.5px] font-bold tracking-[.14em] px-2 py-1 rounded-md bg-ac text-act">NOWOŚĆ</span>
                    <span className="text-[12.5px] text-mu">Dodano {addedAgo(h.created_at)}</span>
                  </div>
                  <div className="text-[28px] font-extrabold tracking-[-.035em] text-center px-7 leading-[1.08] text-balance">
                    {h.title}
                  </div>
                  <div className="text-sm text-mu">
                    {[h.artist_creator, categoryDef(h.category).one].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
            {hero.length > 1 && (
              <div className="flex justify-center gap-1.5 pt-[18px] pb-1">
                {hero.map((h, i) => (
                  <button
                    key={h.id}
                    type="button"
                    aria-label={`Nowość ${i + 1}`}
                    onClick={() => scrollHeroTo(i)}
                    className="h-1.5 rounded-[3px] p-0 transition-all duration-300"
                    style={{ width: i === heroIdx ? 22 : 6, background: i === heroIdx ? "var(--ac)" : "var(--s2)" }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {isLoading ? (
          <div className="flex gap-3 px-5 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-[116px] h-[174px] rounded-[10px] bg-s1 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="mx-5 mt-6 px-5 py-11 rounded-[18px] bg-s1 border border-s2 text-center">
            <p className="text-[15px] font-semibold">Pusta kolekcja</p>
            <p className="text-[13px] text-mu mt-1">Zeskanuj pierwszą okładkę, a pojawi się tutaj.</p>
            <button
              type="button"
              onClick={onAdd}
              className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-ac text-act font-semibold text-[15px]"
            >
              <Icon name="add" size={20} />
              Dodaj pozycję
            </button>
          </div>
        ) : (
          rows.map((r) => (
            <section key={r.value} aria-label={r.label} className="mt-[26px]">
              <div className="flex items-baseline justify-between px-5">
                <h2 className="text-lg font-bold tracking-[-.02em]">{r.label}</h2>
                <span className="text-[13px] text-mu">{r.items.length}</span>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-none px-5 pt-3 pb-1 snap-x snap-mandatory scroll-px-5">
                {r.items.map((it) => (
                  <RowCard key={it.id} item={it} onOpen={onOpen} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
