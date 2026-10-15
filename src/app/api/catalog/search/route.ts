import { NextRequest, NextResponse } from "next/server";
import { toClientPayload } from "@/lib/catalog/lookup";
import { searchCatalog } from "@/lib/catalog/search";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const query = body && typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: "Podaj tekst wyszukiwania (pole 'query')." }, { status: 400 });
    }

    const items = await searchCatalog(query);
    return NextResponse.json({ success: true, data: items.map(toClientPayload) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Wystąpił błąd podczas wyszukiwania.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
