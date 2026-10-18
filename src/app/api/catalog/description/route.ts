import { NextRequest, NextResponse } from "next/server";
import { findWikipediaDescription } from "@/lib/catalog/providers/wikipedia";
import { requestLocale } from "@/lib/i18n/server";
import { translator } from "@/lib/i18n/translate";

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Short description of an item in the UI language (English Wikipedia as fallback), shown in its detail view. */
export async function POST(req: NextRequest) {
  const locale = requestLocale(req);
  const body = await req.json().catch(() => null);
  const title = text(body?.title);
  if (!title) {
    return NextResponse.json({ error: translator(locale)("api.titleRequired") }, { status: 400 });
  }
  const data = await findWikipediaDescription(
    {
      title,
      creator: text(body.creator),
      category: text(body.category) ?? undefined,
    },
    locale
  );
  return NextResponse.json({ success: true, data });
}
