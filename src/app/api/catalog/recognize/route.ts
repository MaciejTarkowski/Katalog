import { NextRequest, NextResponse } from "next/server";
import { guardRequest } from "@/lib/api/guard";
import { GeminiUnavailableError, recognizeCover } from "@/lib/recognize/gemini";
import { mergeRecognition } from "@/lib/recognize/merge";
import { requestTranslator } from "@/lib/i18n/server";

const DATA_URL_RE = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/;

export async function POST(req: NextRequest) {
  const denied = await guardRequest(req, "recognize");
  if (denied) return denied;
  const t = requestTranslator(req);
  const body = await req.json().catch(() => null);
  const match = typeof body?.image === "string" ? body.image.match(DATA_URL_RE) : null;
  if (!match) {
    return NextResponse.json(
      { error: t("api.imageRequired") },
      { status: 400 }
    );
  }

  let recognized;
  try {
    recognized = await recognizeCover({ mimeType: match[1], data: match[2] });
  } catch (err: unknown) {
    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json({ error: t("api.recognizeUnavailable"), unavailable: true }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : t("api.recognizeUnavailable");
    return NextResponse.json({ error: message, unavailable: true }, { status: 503 });
  }

  if (!recognized) {
    return NextResponse.json(
      { error: t("add.notRecognized") },
      { status: 404 }
    );
  }

  // Answer as soon as the cover is recognized; the client fetches the catalog cover and details
  // from /api/catalog/enrich with `recognized`, so the title shows up without waiting for catalogs.
  return NextResponse.json({ success: true, data: mergeRecognition(recognized, null), recognized });
}
