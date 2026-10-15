"use client";

import { useEffect, useRef, useState } from "react";
import type { Item } from "@/types/database";
import { collectionSummary } from "@/lib/items/display";
import { Cover, Icon } from "@/components/ui/primitives";

interface ShareScreenProps {
  userId: string;
  name: string;
  items: Item[];
  onToast: (message: string) => void;
}

export function ShareScreen({ userId, name, items, onToast }: ShareScreenProps) {
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const covered = items.filter((i) => i.cover_url);
  const fan = [covered[0] ?? items[0], covered[1] ?? items[1], covered[2] ?? items[2]];

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const reveal = () => {
    if (!shared) onToast("Link do kolekcji jest gotowy");
    setShareUrl(`${window.location.origin}/share/${userId}`);
    setShared(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      return;
    }
    clearTimeout(copyTimer.current);
    setCopied(true);
    onToast("Skopiowano link do schowka!");
    copyTimer.current = setTimeout(() => setCopied(false), 2500);
  };

  const fanCard = (item: Item | undefined, style: React.CSSProperties, big?: boolean) => (
    <div className="absolute left-1/2 overflow-hidden bg-s1" style={style}>
      {item && <Cover title={item.title} seed={item.id} src={item.cover_url} letterSize={big ? 64 : 56} className="w-full h-full" />}
    </div>
  );

  return (
    <div className="px-6 pt-[max(12px,env(safe-area-inset-top))] pb-[120px] grid content-start grid-cols-[minmax(0,1fr)]">
      <h1 className="text-[30px] font-extrabold tracking-[-.04em] pt-[18px]">Udostępnij</h1>
      <p className="text-[15px] text-mu mt-1.5 leading-[1.45] text-pretty">
        Każdy z linkiem zobaczy Twoją kolekcję — bez zakładania konta.
      </p>

      <div aria-hidden="true" className="relative h-[250px] mt-[34px]">
        {fanCard(fan[2], { top: 22, width: 124, height: 186, marginLeft: -62, borderRadius: 12, transform: "translateX(-78px) rotate(-11deg)", boxShadow: "0 20px 40px -14px rgba(0,0,0,.8)" })}
        {fanCard(fan[1], { top: 22, width: 124, height: 186, marginLeft: -62, borderRadius: 12, transform: "translateX(78px) rotate(11deg)", boxShadow: "0 20px 40px -14px rgba(0,0,0,.8)" })}
        {fanCard(fan[0], { top: 0, width: 140, height: 210, marginLeft: -70, borderRadius: 13, boxShadow: "0 26px 50px -14px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.1)" }, true)}
      </div>

      <div className="text-center flex flex-col gap-[3px]">
        <div className="text-lg font-bold">Kolekcja: {name}</div>
        <div className="text-[13.5px] text-mu">{collectionSummary(items)}</div>
      </div>

      <button
        type="button"
        onClick={reveal}
        className="mt-7 h-14 rounded-2xl bg-ac text-act text-[17px] font-semibold flex items-center justify-center gap-2 shadow-[0_14px_34px_-12px_var(--ac)]"
      >
        <Icon name="ios_share" />
        Udostępnij
      </button>

      <div
        aria-hidden={!shared}
        inert={!shared}
        className="overflow-hidden"
        style={{
          maxHeight: shared ? 140 : 0,
          opacity: shared ? 1 : 0,
          transform: `translateY(${shared ? 0 : -8}px)`,
          transition: "max-height .5s cubic-bezier(.2,.8,.2,1), opacity .4s .1s, transform .5s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div className="text-[13px] font-medium text-mu mt-[22px] mb-2">Link do kolekcji</div>
        <div className="flex gap-2.5">
          <div className="flex-1 min-w-0 h-[52px] px-4 rounded-[15px] bg-s1 border border-s2 flex items-center font-mono text-sm">
            <span className="truncate" data-testid="share-url">{shareUrl.replace(/^https?:\/\//, "")}</span>
          </div>
          <button
            type="button"
            onClick={copy}
            aria-label="Kopiuj link"
            className="w-[52px] h-[52px] flex-none rounded-[15px] border flex items-center justify-center p-0 transition-all duration-200"
            style={
              copied
                ? { background: "var(--ac)", color: "var(--acT)", borderColor: "var(--ac)" }
                : { background: "var(--s1)", color: "var(--tx)", borderColor: "var(--s2)" }
            }
          >
            <Icon name={copied ? "check" : "content_copy"} />
          </button>
        </div>
      </div>
    </div>
  );
}
