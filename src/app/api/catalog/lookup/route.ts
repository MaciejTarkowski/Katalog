import { NextRequest, NextResponse } from "next/server";
import { lookupCatalogItem, toClientPayload } from "@/lib/catalog/lookup";
import { normalizeEan } from "@/lib/catalog/normalize";
import { requestTranslator } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const t = requestTranslator(req);
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: t("api.badBody") }, { status: 400 });
    }

    const eanRaw = typeof body.ean === "string" ? body.ean.trim() : "";
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const category = typeof body.category === "string" ? body.category : undefined;

    if (!eanRaw && !query) {
      return NextResponse.json(
        { error: t("api.eanOrQuery") },
        { status: 400 }
      );
    }

    if (eanRaw && !normalizeEan(eanRaw)) {
      return NextResponse.json(
        { error: t("api.badEan") },
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
        { error: t("api.noMetadata") },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toClientPayload(item),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : t("api.lookupError");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
