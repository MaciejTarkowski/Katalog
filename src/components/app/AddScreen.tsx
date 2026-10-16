"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemInsert } from "@/types/database";
import { searchCommunityItems } from "@/lib/items/api";
import { uploadCoverImage } from "@/lib/storage/upload";
import { PHASE_LABEL, ScanError, scanCoverFile, searchCatalogItems, type CatalogSearchPage, type ScannedItemData } from "@/lib/scan/pipeline";
import { CATEGORIES, metaLine, pillStyle, plural, tileBackground, initialOf } from "@/lib/items/display";
import { Chip, Cover, Icon, Sheet } from "@/components/ui/primitives";
import { AddItemForm } from "@/components/items/AddItemForm";

export type NewItem = Omit<ItemInsert, "id" | "user_id" | "created_at" | "updated_at">;

interface AddScreenProps {
  /** Resolves to null on success, or the error message to show. */
  onAdd: (item: NewItem) => Promise<string | null>;
  onToast: (message: string) => void;
}

type Phase = "idle" | "scanning" | "found";
type Dialog = "reject" | "text" | "manual" | null;

/** Labels cycled while a picked search result "scans" in. */
const FAST_LABELS = [PHASE_LABEL.compressing, PHASE_LABEL.recognize, PHASE_LABEL.lookup];
const SPARKS: Array<[number, number, number]> = [
  [-118, -118, 14], [112, -96, 10], [-130, 18, 9], [124, 44, 15],
  [-96, 128, 11], [100, 136, 9], [-12, -158, 10], [18, 160, 13],
];

function resultKey(r: ScannedItemData, i: number) {
  return `${r.title}|${r.artist_creator ?? ""}|${r.category}|${i}`;
}

function Stage({
  phase,
  item,
  burstKey,
  scanKey,
  onTap,
}: {
  phase: Phase;
  item: ScannedItemData | null;
  burstKey: number;
  scanKey: number;
  onTap: () => void;
}) {
  const idle = phase === "idle";
  const scan = phase === "scanning";
  const found = phase === "found";
  const W = idle ? 188 : 176;
  const H = idle ? 188 : 264;
  const R = idle ? 94 : 16;
  const ease = "cubic-bezier(.65,0,.2,1)";
  const cover = item ? item.cover_url || item.previewUrl : null;
  const shadow = found
    ? "0 0 0 1px rgba(255,255,255,.1), 0 34px 80px -16px var(--ac)"
    : idle
      ? "0 0 0 1px color-mix(in oklch, var(--ac) 45%, transparent)"
      : "0 0 0 1px color-mix(in oklch, var(--ac) 50%, transparent), 0 0 50px -10px var(--ac)";

  return (
    <div className="relative w-[320px] h-[330px] grid place-items-center">
      <div
        aria-hidden="true"
        className="relative overflow-hidden pointer-events-none"
        style={{
          gridArea: "1/1",
          width: W + 34,
          height: H + 34,
          borderRadius: R + 17,
          filter: "blur(20px)",
          opacity: found ? 0.5 : 0.95,
          transition: `width .9s ${ease}, height .9s ${ease}, border-radius .9s ${ease}, opacity .8s`,
        }}
      >
        <div
          className="absolute -left-1/2 -top-1/2 w-[200%] h-[200%]"
          style={{
            background: "conic-gradient(from 0deg, var(--ac), var(--ac2), transparent 40%, var(--ac), var(--ac2), transparent 90%, var(--ac))",
            animation: `kSpin ${scan ? 2.2 : 6}s linear infinite`,
          }}
        />
      </div>

      <button
        type="button"
        onClick={idle ? onTap : undefined}
        disabled={!idle}
        aria-label={idle ? "Zeskanuj okładkę" : found && item ? item.title : "Skanowanie"}
        className="relative overflow-hidden bg-s1 p-0 disabled:cursor-default"
        style={{
          gridArea: "1/1",
          width: W,
          height: H,
          borderRadius: R,
          boxShadow: shadow,
          border: idle ? "1px solid color-mix(in oklch, var(--ac) 40%, transparent)" : "1px solid transparent",
          transition: `width .9s ${ease}, height .9s ${ease}, border-radius .9s ${ease}, box-shadow .7s`,
          animation: idle ? "kBreath 2.6s ease-in-out infinite" : "none",
        }}
      >
        <span
          className="ms ms-fill absolute left-1/2 top-1/2 text-ac"
          aria-hidden="true"
          style={{
            fontSize: 76,
            transform: `translate(-50%,-50%) scale(${idle ? 1 : 0.4})`,
            opacity: idle ? 1 : 0,
            transition: "all .45s",
          }}
        >
          photo_camera
        </span>
        <span
          // Remounted on every new scan (scanKey) so the sweep always restarts from its first
          // frame — left running continuously it kept whatever point it happened to be at in its
          // loop, so each scan appeared to start mid-sweep instead of from the left edge.
          key={`shimmer${scanKey}`}
          data-testid="stage-shimmer"
          aria-hidden="true"
          // 260% wide strip slid with transform (GPU) — animating background-position repainted
          // every frame on the main thread and stuttered on phones.
          className="absolute inset-y-0 left-0 w-[260%]"
          style={{
            background:
              "linear-gradient(110deg, transparent 30%, color-mix(in oklch, var(--ac) 30%, transparent) 46%, rgba(255,255,255,.18) 50%, color-mix(in oklch, var(--ac2) 30%, transparent) 54%, transparent 70%)",
            animation: "kShimmerX 1.5s linear infinite",
            willChange: "transform",
            opacity: scan ? 1 : 0,
            transition: "opacity .5s",
          }}
        />
        <span
          // Full-height layer moved with translateY (90% of the stage height) so the line glides on
          // the GPU instead of re-laying out `top` every frame; linear so it never stalls at the edges.
          key={`scanline${scanKey}`}
          data-testid="stage-scanline-sweep"
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            animation: "kScan 1.3s linear infinite alternate",
            willChange: "transform",
            opacity: scan ? 1 : 0,
            transition: "opacity .4s",
          }}
        >
          <span
            className="absolute left-2.5 right-2.5 top-[4%] h-0.5 rounded-sm bg-ac"
            style={{ boxShadow: "0 0 14px 3px var(--ac)" }}
          />
        </span>
        {item && (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-[72px] font-extrabold text-white/25"
            style={{ background: tileBackground(item.title), opacity: found ? 1 : 0, transition: "opacity .8s" }}
          >
            {initialOf(item.title)}
          </span>
        )}
        {item && cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            onError={(e) => (e.currentTarget.style.opacity = "0")}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: found ? 1 : 0,
              filter: found ? "blur(0px) saturate(1)" : "blur(18px) saturate(1.8)",
              transform: found ? "scale(1)" : "scale(1.18)",
              transition: "opacity .9s .1s, filter 1.2s cubic-bezier(.2,.7,.2,1) .1s, transform 1.2s cubic-bezier(.2,.7,.2,1) .1s",
            }}
          />
        )}
        {found && burstKey > 0 && (
          <span
            key={`fl${burstKey}`}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(circle, #fff, color-mix(in oklch, var(--ac) 60%, transparent) 60%, transparent)",
              animation: "kFlash 1s ease-out forwards",
            }}
          />
        )}
      </button>

      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: scan ? 1 : 0, transition: "opacity .4s" }}
      >
        {SPARKS.map(([x, y, s], i) => (
          <span
            key={`sp${i}`}
            className="absolute pointer-events-none leading-none"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              fontSize: s,
              color: i % 2 ? "var(--ac2)" : "#fff",
              textShadow: "0 0 10px var(--ac)",
              // Kept running continuously (never toggled to "none") so hiding it via the
              // wrapper's opacity transition fades it out instead of snapping mid-twinkle.
              animation: `kTwinkle 1.6s ${i * 0.2}s ease-in-out infinite`,
            }}
          >
            ✦
          </span>
        ))}
      </div>

      {found &&
        burstKey > 0 &&
        Array.from({ length: 16 }, (_, i) => {
          const ang = (i / 16) * Math.PI * 2;
          const d = 130 + (i % 3) * 30;
          const size = i % 4 ? 6 : 9;
          return (
            <span
              key={`b${burstKey}-${i}`}
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
              style={
                {
                  width: size,
                  height: size,
                  margin: -3,
                  background: ["var(--ac)", "#fff", "var(--ac2)"][i % 3],
                  boxShadow: "0 0 10px var(--ac)",
                  "--dx": `${Math.cos(ang) * d}px`,
                  "--dy": `${Math.sin(ang) * d}px`,
                  animation: `kBurst 1.1s cubic-bezier(.1,.7,.3,1) ${0.15 + (i % 4) * 0.03}s both`,
                } as React.CSSProperties
              }
            />
          );
        })}
    </div>
  );
}

const inCategory = (value: string) => (value === "all" ? undefined : value);

export function AddScreen({ onAdd, onToast }: AddScreenProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [label, setLabel] = useState("");
  const [item, setItem] = useState<ScannedItemData | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [scanKey, setScanKey] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScannedItemData[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [searchCategory, setSearchCategory] = useState<string>("all");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const searchSeq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      clearTimeout(searchTimer.current);
    },
    []
  );

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const showFound = (data: ScannedItemData) => {
    setItem(data);
    setPhase("found");
    setBurstKey(Date.now());
  };

  const reset = () => {
    setPhase("idle");
    setItem(null);
    setLabel("");
  };

  const openText = (initial = "") => {
    setResults([]);
    search(initial);
    setDialog("text");
  };

  const pickPhoto = () => {
    setDialog(null);
    fileRef.current?.click();
  };

  const startScanning = () => {
    setScanKey((k) => k + 1);
    setPhase("scanning");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setItem(null);
    setNotice(null);
    startScanning();
    try {
      const data = await scanCoverFile(file, (p) => setLabel(PHASE_LABEL[p]));
      showFound(data);
    } catch (err: unknown) {
      reset();
      setNotice(err instanceof Error ? err.message : "Nie udało się rozpoznać okładki.");
      openText(err instanceof ScanError ? err.query : "");
    }
  };

  // Debounced search over catalogs (one page per call) and other users' items.
  const search = (value: string, category = searchCategory) => {
    setQuery(value);
    setSelected(null);
    pageRef.current = 0;
    setHasMore(false);
    setLoadingMore(false);
    clearTimeout(searchTimer.current);
    const text = value.trim();
    const seq = ++searchSeq.current;
    if (!text) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const [catalog, community] = await Promise.all([
        searchCatalogItems(text, { category: inCategory(category) }).catch(
          (): CatalogSearchPage => ({ items: [], hasMore: false })
        ),
        searchCommunityItems(text).then((r) => r.data ?? []).catch(() => []),
      ]);
      if (seq !== searchSeq.current) return;
      const communityHits = community.filter((r) => !inCategory(category) || r.category === category);
      setResults([...catalog.items, ...communityHits]);
      setHasMore(catalog.hasMore);
      setSearching(false);
    }, 450);
  };

  const loadMore = async () => {
    const text = query.trim();
    if (!text || !hasMore || loadingMore || searching) return;
    const seq = searchSeq.current;
    setLoadingMore(true);
    try {
      const next = await searchCatalogItems(text, { category: inCategory(searchCategory), page: pageRef.current + 1 });
      if (seq !== searchSeq.current) return;
      pageRef.current += 1;
      setResults((prev) => [...prev, ...next.items]);
      setHasMore(next.hasMore);
    } catch {
      if (seq === searchSeq.current) setHasMore(false);
    } finally {
      if (seq === searchSeq.current) setLoadingMore(false);
    }
  };

  // Reaching the end of the list loads the next page.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  });

  const pickSearchCategory = (value: string) => {
    setSearchCategory(value);
    search(query, value);
  };

  const confirmPick = () => {
    if (selected === null) return;
    const picked = results[selected];
    setDialog(null);
    setItem(null);
    later(() => {
      startScanning();
      setLabel(FAST_LABELS[0]);
      FAST_LABELS.slice(1).forEach((l, i) => later(() => setLabel(l), 450 * (i + 1)));
      later(() => showFound(picked), 1700);
    }, 450);
  };

  const confirm = async () => {
    if (!item || saving) return;
    setSaving(true);
    let coverUrl = item.cover_url || item.previewUrl || null;
    if (coverUrl?.startsWith("data:image/")) {
      const { publicUrl, error } = await uploadCoverImage(coverUrl);
      if (error) {
        setSaving(false);
        setNotice(`Błąd przesyłania okładki: ${error}`);
        return;
      }
      coverUrl = publicUrl;
    }
    const addError = await onAdd({
      title: item.title,
      artist_creator: item.artist_creator,
      category: item.category,
      subcategory: item.subcategory,
      cover_url: coverUrl,
      metadata: item.metadata ?? {},
    });
    setSaving(false);
    if (addError) {
      setNotice(addError);
      return;
    }
    onToast(`Dodano „${item.title}” do kolekcji`);
    setNotice(null);
    reset();
  };

  const idle = phase === "idle";
  const found = phase === "found";
  const prompt = idle ? "Dotknij, aby zeskanować okładkę" : phase === "scanning" ? label : "";
  const pickedItem = selected !== null ? results[selected] : null;

  return (
    <div className="fixed inset-0 overflow-clip mx-auto max-w-[480px]">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        data-testid="cover-scan-file-input"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[44%] w-[620px] h-[620px] -ml-[310px] -mt-[310px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle,color-mix(in oklch,var(--ac) 30%,transparent) 0%,color-mix(in oklch,var(--ac2) 12%,transparent) 38%,transparent 66%)",
        }}
      />
      <div
        data-testid="add-screen-stage"
        className="absolute inset-x-0 top-[max(24px,env(safe-area-inset-top))] bottom-24 flex flex-col items-center justify-center gap-2.5 overflow-y-auto scrollbar-none"
      >
        <div className="h-16 flex items-end justify-center px-[30px] text-center">
          <div
            aria-live="polite"
            className="font-extrabold tracking-[-.03em] leading-[1.15] transition-all duration-400"
            style={{ fontSize: idle ? 24 : 16, color: idle ? "var(--tx)" : "var(--mu)" }}
          >
            {prompt}
          </div>
        </div>

        <Stage phase={phase} item={item} burstKey={burstKey} scanKey={scanKey} onTap={pickPhoto} />

        <div className="min-h-[178px] w-full flex flex-col items-center gap-1.5 px-6">
          {notice && (
            <p role="alert" className="text-[13px] text-rose-400 text-center">
              {notice}
            </p>
          )}
          {idle && (
            <button
              type="button"
              onClick={() => openText()}
              className="mt-3.5 flex items-center gap-2 h-[42px] px-[18px] rounded-[21px] bg-white/[.06] border border-s2 text-tx text-sm font-medium"
            >
              <Icon name="keyboard" size={19} />
              lub wpisz tytuł
            </button>
          )}
          {found && item && (
            <>
              <h2 className="text-[26px] font-extrabold tracking-[-.035em] text-center leading-[1.1]">{item.title}</h2>
              {item.artist_creator && <div className="text-[15px] text-mu">{item.artist_creator}</div>}
              <span className="mt-0.5 text-[11px] font-semibold px-[9px] py-[3px] rounded-full border" style={pillStyle(item.category)}>
                {metaLine(item.category, item.subcategory)}
              </span>
              <div className="flex gap-2.5 w-full mt-4">
                <button
                  type="button"
                  onClick={() => setDialog("reject")}
                  className="flex-1 h-[54px] rounded-2xl bg-s1 border border-s2 text-tx text-base font-semibold flex items-center justify-center gap-1.5"
                >
                  <Icon name="close" size={21} />
                  Odrzuć
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={saving}
                  className="flex-[1.5] h-[54px] rounded-2xl bg-ac text-act text-base font-semibold flex items-center justify-center gap-1.5 shadow-[0_14px_30px_-12px_var(--ac)] disabled:opacity-60"
                >
                  <Icon name="check" size={21} />
                  {saving ? "Zapisywanie..." : "Dodaj do kolekcji"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <Sheet open={dialog === "reject"} onClose={() => setDialog(null)} label="Nie ta pozycja?" className="px-5 pb-10 gap-3">
        <h2 className="text-[22px] font-extrabold tracking-[-.03em] px-1 mt-1">Nie ta pozycja?</h2>
        <p className="text-sm text-mu -mt-1.5 mb-1.5 px-1">Wybierz, jak chcesz wyszukać ponownie.</p>
        <SheetOption icon="photo_camera" accent title="Zeskanuj ponownie" sub="Zrób nowe zdjęcie okładki" onClick={pickPhoto} />
        <SheetOption icon="keyboard" title="Wpisz tytuł" sub="Wyszukaj w katalogach i kolekcjach innych" onClick={() => openText(item?.title ?? "")} />
        <SheetOption icon="edit_note" title="Uzupełnij ręcznie" sub="Wpisz wszystkie dane samodzielnie" onClick={() => setDialog("manual")} />
        <button type="button" onClick={() => setDialog(null)} className="h-[46px] mt-1 text-mu text-[15px] font-medium">
          Anuluj
        </button>
      </Sheet>

      <Sheet open={dialog === "text"} onClose={() => setDialog(null)} label="Wyszukaj tytuł" full>
        <div className="px-5 pb-3 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2.5">
            <div>
              <h2 className="text-[22px] font-extrabold tracking-[-.03em]">Wyszukaj tytuł</h2>
              <p className="text-[13.5px] text-mu mt-[3px]">Wpisz tytuł i wybierz istniejący wpis.</p>
            </div>
            <button
              type="button"
              onClick={() => setDialog(null)}
              aria-label="Zamknij"
              className="w-[34px] h-[34px] flex-none rounded-full bg-s2 text-tx flex items-center justify-center p-0"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <div className="flex items-center gap-2.5 h-[50px] px-3.5 rounded-[15px] bg-bg border border-s2">
            <Icon name="search" className="text-mu" />
            <input
              type="search"
              aria-label="Tytuł lub twórca"
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Tytuł lub twórca"
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-tx text-base"
            />
          </div>
          <div role="tablist" aria-label="Kategoria wyszukiwania" className="flex gap-2 overflow-x-auto scrollbar-none">
            <Chip role="tab" active={searchCategory === "all"} onClick={() => pickSearchCategory("all")}>
              Wszystkie
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.value} role="tab" active={searchCategory === c.value} onClick={() => pickSearchCategory(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="text-[12.5px] text-mu">
            {searching
              ? "Szukam..."
              : query.trim()
                ? `${results.length} ${plural(results.length, ["wpis", "wpisy", "wpisów"])} w katalogach i kolekcjach`
                : "Wpisz co najmniej kilka liter"}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-[120px] flex flex-col gap-2">
          {results.map((r, i) => {
            const on = selected === i;
            return (
              <button
                key={resultKey(r, i)}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(on ? null : i)}
                className="flex-none flex items-center gap-3 py-2 pl-2 pr-3 rounded-2xl bg-bg border-[1.5px] text-tx text-left transition-colors"
                style={{ borderColor: on ? "var(--ac)" : "var(--s2)" }}
              >
                <Cover title={r.title} seed={r.title} src={r.cover_url} letterSize={18} className="w-11 h-[66px] flex-none rounded-[7px]" />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold truncate">{r.title}</span>
                  {r.artist_creator && <span className="text-[13px] text-mu truncate">{r.artist_creator}</span>}
                  <span className="text-[11.5px] text-mu opacity-75">{metaLine(r.category, r.subcategory)}</span>
                </span>
                <span
                  className="w-[26px] h-[26px] flex-none rounded-full flex items-center justify-center border-[1.5px] text-act"
                  style={{ borderColor: on ? "var(--ac)" : "var(--s2)", background: on ? "var(--ac)" : "transparent" }}
                >
                  {on && <Icon name="check" size={17} />}
                </span>
              </button>
            );
          })}
          {hasMore && (
            <div ref={sentinelRef} className="flex-none py-3 text-center text-[12.5px] text-mu">
              {loadingMore ? "Ładuję więcej..." : ""}
            </div>
          )}
        </div>
        <div className="absolute left-0 right-0 bottom-0 px-5 pt-4 pb-[max(34px,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 bg-[linear-gradient(180deg,transparent,var(--s1)_40%)]">
          <div className="text-[13.5px] text-mu flex-1">{pickedItem ? `Wybrano: ${pickedItem.title}` : "Wybierz pozycję z listy"}</div>
          <button
            type="button"
            onClick={confirmPick}
            disabled={!pickedItem}
            aria-label="Dodaj wybraną pozycję"
            className="w-16 h-16 flex-none rounded-full gradient-ac text-act flex items-center justify-center p-0 transition-all duration-300 shadow-[0_14px_30px_-10px_var(--ac)]"
            style={{ opacity: pickedItem ? 1 : 0.35, transform: `scale(${pickedItem ? 1 : 0.9})` }}
          >
            <Icon name="add" size={34} />
          </button>
        </div>
      </Sheet>

      <Sheet open={dialog === "manual"} onClose={() => setDialog(null)} label="Uzupełnij ręcznie" full>
        <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-10">
          {dialog === "manual" && (
            <AddItemForm
              onSubmit={async (data) => {
                const addError = await onAdd(data);
                if (!addError) {
                  onToast(`Dodano „${data.title}” do kolekcji`);
                  setDialog(null);
                  reset();
                }
                return addError;
              }}
              onCancel={() => setDialog(null)}
            />
          )}
        </div>
      </Sheet>
    </div>
  );
}

function SheetOption({
  icon,
  title,
  sub,
  accent,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3.5 p-3.5 rounded-[18px] bg-bg border border-s2 text-tx text-left"
    >
      <span
        className={`ms w-[46px] h-[46px] rounded-[14px] flex-none flex items-center justify-center ${accent ? "gradient-ac text-act" : "bg-s2 text-tx"}`}
        style={{ fontSize: 24 }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex-1 flex flex-col gap-0.5">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-[13px] text-mu">{sub}</span>
      </span>
      <Icon name="chevron_right" className="text-mu" />
    </button>
  );
}
