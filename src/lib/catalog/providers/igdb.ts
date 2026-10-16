import { catalogFetch, readJson } from "../http";

interface IgdbGame {
  name?: string;
  cover?: { image_id?: string };
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

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Box-art URL from IGDB (free with Twitch credentials), or null. RAWG only has screenshots. */
export async function findIgdbCover(title: string): Promise<string | null> {
  const id = process.env.IGDB_CLIENT_ID;
  const secret = process.env.IGDB_CLIENT_SECRET;
  if (!id || !secret) return null;

  try {
    const bearer = await accessToken(id, secret);
    if (!bearer) return null;

    const res = await catalogFetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": id, Authorization: `Bearer ${bearer}`, "Content-Type": "text/plain" },
      body: `search "${title.replace(/["\\]/g, " ")}"; fields name,cover.image_id; limit 5;`,
    });
    const games = (await readJson<IgdbGame[]>(res)) ?? [];
    const withCover = games.filter((g) => g.cover?.image_id);
    const match =
      withCover.find((g) => g.name && normalize(g.name) === normalize(title)) ?? withCover[0];
    return match?.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${match.cover.image_id}.jpg`
      : null;
  } catch {
    return null;
  }
}
