"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Item } from "@/types/database";
import { fetchItemById } from "@/lib/items/api";
import { fetchItemDescription, type ItemDescription } from "@/lib/items/description";
import { categoryDef, formatDate, pillStyle, tileBackground } from "@/lib/items/display";
import { useI18n } from "@/lib/i18n/locale";
import type { MessageKey, Translate } from "@/lib/i18n/translate";
import { Cover, Icon } from "@/components/ui/primitives";

interface ItemDetailViewProps {
  /** Item to fetch; ignored when `item` is given. */
  itemId?: string;
  item?: Item;
  fromShare?: boolean;
  /** In-app back action; without it the back button links to the collection. */
  onBack?: () => void;
  onDelete?: (item: Item) => void;
  /** Items shown in the "Więcej" row (same category). */
  similar?: Item[];
  onOpen?: (item: Item) => void;
  /** Gets the item with a newly looked-up description in its metadata, to save it. */
  onItemChange?: (item: Item) => void;
}

const METADATA_LABELS: Record<string, MessageKey> = {
  year: "meta.year",
  publisher: "meta.publisher",
  isbn: "meta.isbn",
  barcode: "meta.barcode",
  genre: "meta.genre",
  platform: "meta.platform",
  label: "meta.label",
  format: "meta.format",
  country: "meta.country",
  pages: "meta.pages",
};

/** Readable metadata rows: primitives (and string lists) only, no technical ids or source. */
function metadataRows(metadata: Record<string, unknown>, t: Translate): Array<[string, string]> {
  return Object.entries(metadata || {}).flatMap(([key, value]): Array<[string, string]> => {
    if (key.endsWith("_id") || key === "source" || key.startsWith("description")) return [];
    const text = Array.isArray(value)
      ? value.filter((v) => typeof v === "string" || typeof v === "number").join(", ")
      : typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
    if (!text) return [];
    return [[METADATA_LABELS[key] ? t(METADATA_LABELS[key]) : key, text]];
  });
}

interface Tilt {
  rx: number;
  ry: number;
  gx: number;
  gy: number;
}

/** Cover that flips in (3D) and then follows the finger/pointer with a glare. */
function CoverStage({ item }: { item: Item }) {
  const [entered, setEntered] = useState(false);
  const [settled, setSettled] = useState(false);
  const [tilt, setTilt] = useState<Tilt | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => setEntered(true));
    });
    const t = setTimeout(() => setSettled(true), 900);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(t);
    };
  }, []);

  const square = item.category === "music";
  const W = square ? 236 : 216;
  const H = square ? 236 : 324;
  const top = square ? 128 : 104;
  const t = tilt ?? { rx: 0, ry: 0, gx: 50, gy: 50 };

  return (
    <div
      className="relative"
      style={{ height: top + H + 34 }}
      onPointerMove={
        settled
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = (e.clientX - r.left) / r.width;
              const py = (e.clientY - r.top) / r.height;
              setTilt({ rx: (0.5 - py) * 18, ry: (px - 0.5) * 22, gx: px * 100, gy: py * 100 });
            }
          : undefined
      }
      onPointerLeave={() => setTilt(null)}
    >
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[640px] overflow-hidden pointer-events-none"
        style={{ opacity: entered ? 1 : 0, transition: "opacity .9s" }}
      >
        <div className="absolute inset-0" style={{ background: tileBackground(item.id), filter: "blur(30px)", transform: "scale(1.3)" }} />
        {item.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.cover_url}
            alt=""
            onError={(e) => (e.currentTarget.style.display = "none")}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "blur(40px) saturate(1.5)", transform: "scale(1.4)" }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklch, var(--bg) 45%, transparent) 0%, color-mix(in oklch, var(--bg) 30%, transparent) 40%, var(--bg) 100%)",
          }}
        />
      </div>

      <div
        className="absolute left-1/2 rounded-2xl overflow-hidden"
        style={{
          top,
          width: W,
          height: H,
          marginLeft: -W / 2,
          transform: entered
            ? `perspective(1000px) rotateX(${t.rx}deg) rotateY(${t.ry}deg)`
            : "perspective(1000px) rotateY(-100deg) scale(.85)",
          opacity: entered ? 1 : 0,
          transition: settled ? "transform .2s ease-out" : "transform 1.1s cubic-bezier(.2,.8,.2,1), opacity .5s",
          boxShadow: entered
            ? "0 40px 70px -24px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.1)"
            : "0 0 0 1px rgba(255,255,255,.08)",
        }}
      >
        <Cover title={item.title} seed={item.id} src={item.cover_url} alt={item.title} letterSize={84} className="w-full h-full">
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none mix-blend-overlay"
            style={
              tilt
                ? { background: `radial-gradient(circle at ${t.gx}% ${t.gy}%, rgba(255,255,255,.32), transparent 55%)` }
                : {
                    background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,.22) 50%, transparent 65%)",
                    backgroundSize: "250% 100%",
                    animation: entered ? "kShimmer 2.2s .6s ease-out both" : "none",
                    opacity: 0.9,
                  }
            }
          />
        </Cover>
      </div>
    </div>
  );
}

export function ItemDetailView({
  itemId,
  item: givenItem,
  fromShare,
  onBack,
  onDelete,
  similar,
  onOpen,
  onItemChange,
}: ItemDetailViewProps) {
  const { locale, t } = useI18n();
  const [fetched, setFetched] = useState<Item | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [lookedUp, setLookedUp] = useState<{ id: string; found: ItemDescription | null } | null>(null);
  const item = givenItem ?? fetched;
  // Only a non-empty string is a known description; "" (saved by older versions) is looked up again.
  const savedDescription =
    typeof item?.metadata?.description === "string" && item.metadata.description ? item.metadata.description : undefined;
  // A description saved for another UI language (or before languages existed) is looked up again in this one.
  const descriptionCurrent = savedDescription !== undefined && item?.metadata?.description_lang === locale;
  const onItemChangeRef = useRef(onItemChange);
  useEffect(() => {
    onItemChangeRef.current = onItemChange;
  });

  // Items without a description look it up on open; only a found one is saved, so "none" is retried next time.
  useEffect(() => {
    if (!item || descriptionCurrent) return;
    let cancelled = false;
    fetchItemDescription(item).then((found) => {
      if (cancelled || found === undefined) return;
      setLookedUp({ id: item.id, found });
      if (!found) return;
      onItemChangeRef.current?.({
        ...item,
        metadata: { ...item.metadata, description: found.description, description_url: found.url, description_lang: locale },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [item, descriptionCurrent, locale]);

  const found = lookedUp && lookedUp.id === item?.id ? lookedUp.found : null;
  const description = found?.description || savedDescription || "";
  const descriptionUrl =
    found?.url || (typeof item?.metadata?.description_url === "string" ? item.metadata.description_url : "");

  useEffect(() => {
    if (givenItem || !itemId) return;
    let cancelled = false;
    fetchItemById(itemId).then(({ data, error }) => {
      if (cancelled) return;
      setFetched(data);
      setErrorMsg(error);
    });
    return () => {
      cancelled = true;
    };
  }, [itemId, givenItem]);

  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(timer);
  }, [item]);

  const backClass =
    "fixed top-[max(16px,env(safe-area-inset-top))] left-4 z-[26] w-[42px] h-[42px] rounded-full border border-white/10 bg-black/35 backdrop-blur-[14px] text-white flex items-center justify-center p-0";
  const backIcon = <Icon name="arrow_back_ios" size={20} style={{ marginLeft: 5 }} />;
  const backButton = onBack ? (
    <button type="button" onClick={onBack} aria-label={t("detail.back")} className={backClass}>
      {backIcon}
    </button>
  ) : (
    <Link href={fromShare && item ? `/share/${item.user_id}` : "/"} aria-label={t("detail.back")} className={backClass}>
      {backIcon}
    </Link>
  );

  if (errorMsg) {
    return (
      <div className="w-full px-5 pt-[76px]">
        {backButton}
        <div role="alert" className="p-4 rounded-[18px] bg-rose-500/10 border border-rose-500/25 text-rose-400 text-sm text-center">
          {errorMsg}
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="w-full">
        {backButton}
        <p className="text-sm text-mu py-24 text-center">{t("detail.loading")}</p>
      </div>
    );
  }

  const cat = categoryDef(item.category, t);
  const rows = metadataRows(item.metadata, t);
  const fade = (delay: number): React.CSSProperties => ({
    opacity: shown ? 1 : 0,
    transform: `translateY(${shown ? 0 : 18}px)`,
    transition: `opacity .5s ${delay}s, transform .7s ${delay}s cubic-bezier(.2,.8,.2,1)`,
  });

  return (
    <div className="relative w-full overflow-x-hidden pb-[120px]">
      {backButton}
      <CoverStage key={item.id} item={item} />

      <div className="relative flex flex-col items-center gap-1.5 px-6 text-center" style={fade(0.3)}>
        <div className="flex gap-1.5 justify-center flex-wrap">
          <span className="text-[11.5px] font-semibold px-2.5 py-[3px] rounded-full border" style={pillStyle(item.category)}>
            {cat.one}
          </span>
          {item.subcategory && (
            <span className="text-[11.5px] font-medium px-2.5 py-[3px] rounded-full bg-s1 text-mu border border-s2">
              {item.subcategory}
            </span>
          )}
        </div>
        <h1 className="mt-1.5 text-[30px] font-extrabold tracking-[-.04em] leading-[1.08] text-balance break-words">{item.title}</h1>
        {item.artist_creator && <div className="text-base text-mu">{item.artist_creator}</div>}
        {onDelete && (
          <div className="flex w-full mt-[18px]">
            <button
              type="button"
              onClick={() => onDelete(item)}
              aria-label={t("detail.deleteLabel", { title: item.title })}
              className="flex-1 h-[50px] rounded-[15px] bg-rose-400/[.08] border border-rose-400/25 text-rose-400 text-[15px] font-semibold flex items-center justify-center gap-[7px]"
            >
              <Icon name="delete" size={20} />
              {t("detail.delete")}
            </button>
          </div>
        )}
      </div>

      <div className="relative mx-5 mt-7" style={fade(0.42)}>
        {description && (
          <section className="mb-7" style={{ animation: "kToastIn .5s both" }}>
            <h2 className="text-lg font-bold tracking-[-.02em] mb-2.5">{t("detail.description")}</h2>
            <p className="text-[14.5px] leading-[1.55] text-tx/90 whitespace-pre-line">{description}</p>
            {descriptionUrl && (
              <a
                href={descriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs text-mu underline underline-offset-2"
              >
                {t("detail.source")}
              </a>
            )}
          </section>
        )}
        {rows.length > 0 && (
          <>
            <h2 className="text-lg font-bold tracking-[-.02em] mb-2.5">{t("detail.details")}</h2>
            <dl className="flex flex-col gap-px bg-s2 rounded-[18px] overflow-hidden border border-s2">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-4 py-[13px] bg-s1 text-sm">
                  <dt className="text-mu">{label}</dt>
                  <dd className="font-medium text-right break-words min-w-0">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <p className="text-xs text-mu mt-2.5 px-1">{t("detail.added", { date: formatDate(item.created_at, locale) })}</p>
      </div>

      {similar && similar.length > 0 && onOpen && (
        <section aria-label={t("detail.more")} className="relative mt-[30px]" style={{ opacity: shown ? 1 : 0, transition: "opacity .5s .55s" }}>
          <h2 className="px-5 text-lg font-bold tracking-[-.02em]">{t("detail.moreOf", { category: cat.label.toLowerCase() })}</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-none px-5 pt-3 pb-1">
            {similar.map((it) => (
              <button key={it.id} type="button" onClick={() => onOpen(it)} className="flex-none w-[104px] flex flex-col gap-1.5 text-left">
                <Cover
                  title={it.title}
                  seed={it.id}
                  src={it.cover_url}
                  letterSize={40}
                  showTitle
                  className="w-[104px] h-[156px] rounded-[10px] shadow-[0_0_0_1px_rgba(255,255,255,.07)]"
                />
                <span className="text-[12.5px] font-semibold truncate w-full">{it.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
