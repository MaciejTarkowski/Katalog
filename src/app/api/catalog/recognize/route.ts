import { NextRequest, NextResponse } from "next/server";
import { lookupCatalogItem } from "@/lib/catalog/lookup";
import { GeminiUnavailableError, recognizeCover } from "@/lib/recognize/gemini";
import { mergeRecognition } from "@/lib/recognize/merge";

const DATA_URL_RE = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const match = typeof body?.image === "string" ? body.image.match(DATA_URL_RE) : null;
  if (!match) {
    return NextResponse.json(
      { error: "Prześlij zdjęcie jako data URL (pole 'image')." },
      { status: 400 }
    );
  }

  let recognized;
  try {
    recognized = await recognizeCover({ mimeType: match[1], data: match[2] });
  } catch (err: unknown) {
    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json({ error: err.message, unavailable: true }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Błąd rozpoznawania obrazu.";
    return NextResponse.json({ error: message, unavailable: true }, { status: 503 });
  }

  if (!recognized) {
    return NextResponse.json(
      { error: "Nie udało się rozpoznać okładki." },
      { status: 404 }
    );
  }

  const query = [recognized.title, recognized.creator].filter(Boolean).join(" ");
  const item = await lookupCatalogItem({
    query,
    title: recognized.title,
    creator: recognized.creator,
    category: recognized.category,
  }).catch(() => null);

  return NextResponse.json({ success: true, data: mergeRecognition(recognized, item) });
}
