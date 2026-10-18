/** MusicBrainz and Wikipedia ask API clients for a real contact address in the User-Agent. */
export const CATALOG_USER_AGENT = "Katalog/0.1.0 (nerdousai@gmail.com; metadata-lookup)";

/** A provider slower than this is dropped, so it cannot hold up the whole scan. */
export const CATALOG_TIMEOUT_MS = 6000;

export async function catalogFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", CATALOG_USER_AGENT);
  }

  return fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(CATALOG_TIMEOUT_MS),
  });
}

export async function readJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
