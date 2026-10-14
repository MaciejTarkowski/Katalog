"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Item } from "@/types/database";
import { fetchPublicItems } from "@/lib/items/api";
import { fetchProfile } from "@/lib/profiles/api";
import { ItemList } from "./ItemList";

interface PublicCollectionViewProps {
  userId: string;
}

export function PublicCollectionView({ userId }: PublicCollectionViewProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [copied, setCopied] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);

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
    fetchProfile(userId).then(({ data }) => {
      if (!cancelled) setOwnerName(data?.display_name || null);
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

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header card */}
      <div className="w-full max-w-md self-center p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
              Publiczna Kolekcja
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 transition-colors flex items-center gap-1.5"
          >
            {copied ? "✓ Skopiowano link!" : "🔗 Udostępnij"}
          </button>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {ownerName ? `Kolekcja użytkownika ${ownerName}` : "Kolekcja użytkownika"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tryb tylko do odczytu. Zbiory i eksponaty zgromadzone w Katalogu.
          </p>
        </div>
      </div>

      {errorMsg ? (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center"
        >
          {errorMsg}
        </div>
      ) : (
        <ItemList
          items={items}
          isLoading={loading}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          fromShare
        />
      )}

      {/* CTA Footer */}
      <div className="w-full max-w-md self-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center flex flex-col gap-2">
        <p className="text-xs text-slate-400">Podoba Ci się ten zbiór?</p>
        <Link
          href="/"
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all shadow-md shadow-blue-600/20"
        >
          Załóż własny darmowy Katalog
        </Link>
      </div>
    </div>
  );
}
