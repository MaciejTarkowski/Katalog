import { NextRequest, NextResponse } from "next/server";
import { lookupCatalogItem, toClientPayload } from "@/lib/catalog/lookup";
import { normalizeEan } from "@/lib/catalog/normalize";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Nieprawidłowe ciało żądania." }, { status: 400 });
    }

    const eanRaw = typeof body.ean === "string" ? body.ean.trim() : "";
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const category = typeof body.category === "string" ? body.category : undefined;

    if (!eanRaw && !query) {
      return NextResponse.json(
        { error: "Podaj kod EAN albo tekst z OCR (pole 'ean' lub 'query')." },
        { status: 400 }
      );
    }

    if (eanRaw && !normalizeEan(eanRaw)) {
      return NextResponse.json(
        { error: "Kod EAN/ISBN ma nieprawidłowy format." },
        { status: 400 }
      );
    }

    const item = await lookupCatalogItem({
      ean: eanRaw || undefined,
      query: query || undefined,
      category,
    });

    if (!item) {
      return NextResponse.json(
        { error: "Nie znaleziono metadanych w darmowych bazach katalogowych." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toClientPayload(item),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Wystąpił błąd podczas wyszukiwania metadanych.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
