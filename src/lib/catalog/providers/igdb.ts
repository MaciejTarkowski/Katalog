import { catalogFetch, readJson } from "../http";
import { normalizeForMatch, textsOverlap } from "../normalize";
import { samePlatform } from "../platform";

interface IgdbGame {
  name?: string;
  cover?: { image_id?: string };
  platforms?: Array<{ name?: string; abbreviation?: string }>;
}

let token: { value: string; expiresAt: number } | null = null;

export function resetIgdbTokenCache() {
  token = null;
}

async function accessToken(id: string, secret: string): Promise<string | null> {
  if (token && token.expiresAt > Date.now()) return token.value;

  const params = new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" });
  const json = await readJson<{ access_token?: string; expires_in?: number }>(
    await catalogFetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, { method: "POST" })
  );
  if (!json?.access_token) return null;
  // Refresh a minute early.
  token = { value: json.access_token, expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000 };
  return token.value;
}

/**
 * Box-art URL from IGDB (free with Twitch credentials), or null. RAWG only has screenshots.
 * Only a game whose title matches is accepted (never "the first result"); among those the one released on `platform` wins.
 */
export async function findIgdbCover(title: string, platform?: string | null): Promise<string | null> {
  const id = process.env.IGDB_CLIENT_ID;
  const secret = process.env.IGDB_CLIENT_SECRET;
  if (!id || !secret) return null;

  try {
    const bearer = await accessToken(id, secret);
    if (!bearer) return null;

    const res = await catalogFetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": id, Authorization: `Bearer ${bearer}`, "Content-Type": "text/plain" },
      body: `search "${title.replace(/["\\]/g, " ")}"; fields name,cover.image_id,platforms.name,platforms.abbreviation; limit 10;`,
    });
    const games = (await readJson<IgdbGame[]>(res)) ?? [];
    const withCover = games.filter(
      (g) => g.cover?.image_id && g.name && textsOverlap(g.name, title)
    );
    const onPlatform = (g: IgdbGame) =>
      Boolean(platform) && Boolean(g.platforms?.some((p) => samePlatform(p.abbreviation, platform) || samePlatform(p.name, platform)));
    const exact = (g: IgdbGame) => normalizeForMatch(g.name ?? "") === normalizeForMatch(title);
    const match =
      withCover.find((g) => exact(g) && onPlatform(g)) ??
      withCover.find(exact) ??
      withCover.find(onPlatform) ??
      withCover[0];
    return match?.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${match.cover.image_id}.jpg`
      : null;
  } catch {
    return null;
  }
}
