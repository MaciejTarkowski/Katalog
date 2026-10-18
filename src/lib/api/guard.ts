import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestTranslator } from "@/lib/i18n/server";

/** Quota bucket; the limits themselves live in the database function `consume_api_quota`. */
export type QuotaBucket = "recognize" | "catalog";

/**
 * Lets only signed-in users through to a route that spends a limited external API (Gemini, catalogs),
 * and counts the call against their hourly quota. Returns the error response to send, or null to go on.
 * Fails closed: when the quota cannot be checked, the request is refused.
 */
export async function guardRequest(req: Pick<Request, "headers">, bucket: QuotaBucket): Promise<NextResponse | null> {
  const t = requestTranslator(req);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("consume_api_quota", { p_bucket: bucket });
    if (error) throw error;
    if (data === -1) return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
    if (data === 0) return NextResponse.json({ error: t("api.rateLimited") }, { status: 429 });
    return null;
  } catch {
    return NextResponse.json({ error: t("api.guardUnavailable") }, { status: 503 });
  }
}
