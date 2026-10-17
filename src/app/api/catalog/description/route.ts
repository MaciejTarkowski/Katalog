import { NextRequest, NextResponse } from "next/server";
import { findWikipediaDescription } from "@/lib/catalog/providers/wikipedia";

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Short description of an item (Polish Wikipedia), shown in its detail view. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const title = text(body?.title);
  if (!title) {
    return NextResponse.json({ error: "Podaj tytuł (pole 'title')." }, { status: 400 });
  }
  const data = await findWikipediaDescription({
    title,
    creator: text(body.creator),
    category: text(body.category) ?? undefined,
  });
  return NextResponse.json({ success: true, data });
}
