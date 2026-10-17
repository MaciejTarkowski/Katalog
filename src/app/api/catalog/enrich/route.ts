import { NextRequest, NextResponse } from "next/server";
import { lookupCatalogItem } from "@/lib/catalog/lookup";
import { isCatalogCategory } from "@/lib/catalog/types";
import type { RecognizedCover } from "@/lib/recognize/gemini";
import { mergeRecognition } from "@/lib/recognize/merge";

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Second step of a photo scan: catalog cover and details for what /api/catalog/recognize found. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const raw = body?.recognized;
  const title = text(raw?.title);
  if (!title) {
    return NextResponse.json({ error: "Brak rozpoznanego tytułu (pole 'recognized')." }, { status: 400 });
  }

  const recognized: RecognizedCover = {
    title,
    creator: text(raw.creator),
    category: isCatalogCategory(raw.category) ? raw.category : "other",
    subcategory: text(raw.subcategory),
    originalTitle: text(raw.originalTitle),
    ...(raw.box && typeof raw.box === "object" ? { box: raw.box } : {}),
  };

  const item = await lookupCatalogItem({
    query: [recognized.title, recognized.creator].filter(Boolean).join(" "),
    title: recognized.title,
    creator: recognized.creator,
    originalTitle: recognized.originalTitle,
    platform: recognized.category === "game" ? recognized.subcategory : null,
    category: recognized.category,
  }).catch(() => null);

  return NextResponse.json({ success: true, data: mergeRecognition(recognized, item) });
}
