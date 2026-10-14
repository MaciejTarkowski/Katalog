export const CATALOG_USER_AGENT =
  "Katalog/0.1.0 (https://github.com/katalog-app; metadata-lookup)";

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
