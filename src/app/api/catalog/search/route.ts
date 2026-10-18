import { NextRequest, NextResponse } from "next/server";
import { toClientPayload } from "@/lib/catalog/lookup";
import { SEARCH_CATEGORIES, searchCatalog, type SearchCategory } from "@/lib/catalog/search";
import { requestTranslator } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const t = requestTranslator(req);
  try {
    const body = await req.json().catch(() => null);
    const query = body && typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: t("api.queryRequired") }, { status: 400 });
    }

    const category = SEARCH_CATEGORIES.find((c) => c === body.category) as SearchCategory | undefined;
    const categories = Array.isArray(body.categories)
      ? SEARCH_CATEGORIES.filter((c) => (body.categories as unknown[]).includes(c))
      : undefined;
    const offset = Number.isInteger(body.offset) && body.offset > 0 ? body.offset : 0;

    const { items, hasMore } = await searchCatalog(query, { category, categories, offset });
    return NextResponse.json({ success: true, data: items.map(toClientPayload), hasMore });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t("scan.searchError");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
