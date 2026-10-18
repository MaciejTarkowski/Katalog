"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Item } from "@/types/database";
import { fetchPublicItems } from "@/lib/items/api";
import { fetchSharedProfile } from "@/lib/profiles/api";
import { Chip, Cover, SectionLoader } from "@/components/ui/primitives";
import { useImagesReady } from "@/lib/image/useImagesReady";
import { useI18n } from "@/lib/i18n/locale";
import { collectionSummary, filterByTypes, isKnownCategory, otherCategory, visibleCategories, matchesQuery, normalizeForSearch } from "@/lib/items/display";

function RowCard({ item }: { item: Item }) {
  return (
    <article data-testid={`item-card-${item.id}`} className="flex-none w-[116px] flex flex-col gap-[7px] snap-start">
      <Link href={`/item/${item.id}?from=share`} aria-label={item.title} className="block">
        <Cover
          title={item.title}
          seed={item.id}
          src={item.cover_url}
          alt={item.title}
          showTitle
          className="rounded-[10px] shadow-[0_0_0_1px_rgba(255,255,255,.07)]"
          style={{ width: 116, height: 174 }}
        />
      </Link>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold truncate">{item.title}</h3>
        {item.artist_creator && <p className="text-xs text-mu truncate">{item.artist_creator}</p>}
      </div>
    </article>
  );
}

interface PublicCollectionViewProps {
  userId: string;
}

export function PublicCollectionView({ userId }: PublicCollectionViewProps) {
  const { t } = useI18n();
  const [allItems, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  // Categories the owner keeps: undefined until the profile is in, null = all of them.
  const [ownerTypes, setOwnerTypes] = useState<string[] | null | undefined>(undefined);
  // The collection is not shared (or does not exist): the owner has not turned the link on.
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPublicItems(userId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setErrorMsg(error);
      } else if (data) {
        setErrorMsg(null);
        setItems(data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    fetchSharedProfile(userId).then(({ data }) => {
      if (cancelled) return;
      setIsPrivate(!data);
      setOwnerName(data?.display_name || null);
      setOwnerTypes(data?.collection_types ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const query = normalizeForSearch(searchQuery.trim());
  // Categories the owner unchecked are hidden here too (the items stay in the database).
  const items = filterByTypes(allItems, ownerTypes);
  const categories = visibleCategories(ownerTypes, t);
  const hasOther = items.some((i) => !isKnownCategory(i.category));
  const tabs = hasOther ? [...categories, otherCategory(t)] : categories;
  const rows = tabs
    .filter((c) => selectedCategory === "all" || selectedCategory === c.value)
    .map((c) => ({
      ...c,
      items: items.filter(
        (i) =>
          (c.value === "other" ? !isKnownCategory(i.category) : i.category === c.value) &&
          matchesQuery(i, query)
      ),
    }))
    .filter((r) => r.items.length > 0);

  // One loader for the whole collection until the visible covers are in (about one screen per row).
  const visibleCovers = rows
    .flatMap((r) => r.items.slice(0, 6))
    .map((i) => i.cover_url)
    .filter((u): u is string => Boolean(u));
  const coversReady = useImagesReady([...new Set(visibleCovers)]);

  return (
    <div className="flex flex-col w-full pb-10">
      <div className="px-5 pt-2 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10.5px] font-bold tracking-[.14em] px-2 py-1 rounded-md bg-ac text-act uppercase">
            {t("public.badge")}
          </span>
          <button
            type="button"
            onClick={handleCopyLink}
            className="h-[34px] px-[15px] rounded-[17px] border border-white/15 bg-white/[.06] text-tx text-[13px] font-semibold"
          >
            {copied ? t("public.copied") : t("public.share")}
          </button>
        </div>
        <div>
          <h2 className="text-[28px] font-extrabold tracking-[-.035em] leading-[1.08]">
            {ownerName ? t("public.titleOf", { name: ownerName }) : t("public.title")}
          </h2>
          <p className="text-sm text-mu mt-1">
            {t("public.readOnly")}
            {items.length > 0 ? ` · ${collectionSummary(items, t)}` : ""}
          </p>
        </div>
        <input
          type="search"
          aria-label={t("search.inCollection")}
          placeholder={t("search.placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-[50px] px-4 rounded-[14px] bg-bg border border-s2 text-base text-tx placeholder:text-mu/70 outline-none focus:border-ac transition-colors"
        />
      </div>

      <div role="tablist" aria-label={t("common.categories")} className="flex gap-2 overflow-x-auto scrollbar-none px-5 pt-4 pb-1">
        <Chip role="tab" active={selectedCategory === "all"} onClick={() => setSelectedCategory("all")}>
          {t("common.all")}
        </Chip>
        {tabs.map((c) => (
          <Chip key={c.value} role="tab" active={selectedCategory === c.value} onClick={() => setSelectedCategory(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>

      {errorMsg ? (
        <div role="alert" className="mx-5 mt-6 p-4 rounded-[18px] bg-rose-500/10 border border-rose-500/25 text-rose-400 text-sm text-center">
          {errorMsg}
        </div>
      ) : loading || ownerTypes === undefined || !coversReady ? (
        <SectionLoader className="mt-6" />
      ) : isPrivate ? (
        <div className="mx-5 mt-6 px-5 py-11 rounded-[18px] bg-s1 border border-s2 text-center">
          <p className="text-[15px] font-semibold">{t("public.private.title")}</p>
          <p className="text-[13px] text-mu mt-1">{t("public.private.text")}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="mx-5 mt-6 px-5 py-11 rounded-[18px] bg-s1 border border-s2 text-center">
          <p className="text-[15px] font-semibold">{query ? t("search.noResultsFor", { query: searchQuery.trim() }) : t("home.empty.title")}</p>
          <p className="text-[13px] text-mu mt-1">
            {query ? t("search.tryOther") : t("public.emptyCategory")}
          </p>
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
                <RowCard key={it.id} item={it} />
              ))}
            </div>
          </section>
        ))
      )}

      <div className="mx-5 mt-10 px-5 py-6 rounded-[18px] bg-s1 border border-s2 text-center flex flex-col gap-3">
        <p className="text-[13px] text-mu">{t("public.like")}</p>
        <Link href="/" className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-ac text-act font-semibold text-[15px]">
          {t("public.cta")}
        </Link>
      </div>
    </div>
  );
}
