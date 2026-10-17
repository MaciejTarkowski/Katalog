"use client";

import { useEffect, useState } from "react";

/** URLs that finished (loaded or failed) earlier in this session — no need to wait for them again. */
const settled = new Set<string>();

export function __resetLoadedImages() {
  settled.clear();
}

/**
 * Preloads `urls` and reports when all of them have loaded or failed, so a whole section can show
 * one loader instead of tiles popping in one by one. Gives up after `timeoutMs` so a single slow
 * cover never blocks the screen. Once ready it stays ready: covers added later load in place.
 */
export function useImagesReady(urls: string[], timeoutMs = 4000): boolean {
  const pending = urls.filter((u) => !settled.has(u));
  const key = pending.join("\n");
  const [ready, setReady] = useState(false);
  const isReady = ready || pending.length === 0;

  useEffect(() => {
    if (ready || !key) return;
    const list = key.split("\n");
    let left = list.length;
    const finish = () => setReady(true);
    const imgs = list.map((url) => {
      const img = new Image();
      const done = () => {
        img.onload = img.onerror = null;
        settled.add(url);
        if (--left === 0) finish();
      };
      img.onload = img.onerror = done;
      img.src = url;
      if (img.complete) done();
      return img;
    });
    const timer = setTimeout(finish, timeoutMs);
    return () => {
      clearTimeout(timer);
      imgs.forEach((img) => (img.onload = img.onerror = null));
    };
  }, [key, ready, timeoutMs]);

  return isReady;
}
