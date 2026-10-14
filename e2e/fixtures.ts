import { test as base, expect, type Page, type Request } from "@playwright/test";

export const SUPABASE = "http://supabase.test";
export const USER_ID = "11111111-1111-1111-1111-111111111111";
export const USER_EMAIL = "e2e@katalog.test";

export interface MockItem {
  id: string;
  user_id: string;
  title: string;
  artist_creator: string | null;
  category: string;
  subcategory: string | null;
  cover_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function makeItem(partial: Partial<MockItem> & { id: string; title: string }): MockItem {
  return {
    user_id: USER_ID,
    artist_creator: null,
    category: "book",
    subcategory: null,
    cover_url: null,
    metadata: {},
    created_at: "2026-10-01T12:00:00.000Z",
    ...partial,
  };
}

export const SEED_ITEMS: MockItem[] = [
  makeItem({ id: "b1", title: "Hobbit", artist_creator: "J.R.R. Tolkien", category: "book", subcategory: "Fantasy" }),
  makeItem({ id: "b2", title: "Diuna", artist_creator: "Frank Herbert", category: "book", subcategory: "Sci-Fi" }),
  makeItem({ id: "m1", title: "The Dark Side of the Moon", artist_creator: "Pink Floyd", category: "music", subcategory: "Winyl" }),
  makeItem({ id: "g1", title: "Wiedźmin 3", artist_creator: "CD Projekt Red", category: "game", subcategory: "PS5" }),
  makeItem({ id: "c1", title: "Thorgal", artist_creator: "Rosiński", category: "comic", subcategory: null }),
];

/** Wynik zamockowanego rozpoznawania (lookup po kodzie z okładki). */
export const SCANNED = {
  title: "Abbey Road",
  artist_creator: "The Beatles",
  category: "music",
  subcategory: "Winyl",
  cover_url: null,
  metadata: { ean: "0094638246824", source: "musicbrainz" },
};

/** 1×1 PNG jako „zdjęcie okładki”. */
export const COVER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

export interface Backend {
  items: MockItem[];
  inserts: Record<string, unknown>[];
  deletes: string[];
  writes: Request[];
  lookups: Record<string, unknown>[];
}

function sessionBody() {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: "e2e-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "e2e-refresh-token",
    user: userBody(),
  };
}

function userBody() {
  return {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: USER_EMAIL,
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

/** Mockuje Supabase (auth, REST, storage), API lookup i natywny BarcodeDetector. */
export async function mockBackend(page: Page, seed: MockItem[] = SEED_ITEMS): Promise<Backend> {
  const backend: Backend = { items: [...seed], inserts: [], deletes: [], writes: [], lookups: [] };

  // Rozpoznawanie obrazu: kod kreskowy wykryty „natywnie”, bez OCR i bez sieci.
  await page.addInitScript(() => {
    class FakeBarcodeDetector {
      static async getSupportedFormats() {
        return ["ean_13"];
      }
      async detect() {
        return [{ rawValue: "0094638246824" }];
      }
    }
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = FakeBarcodeDetector;
  });

  // Tesseract (OCR) nigdy nie powinien sięgać do sieci w testach.
  await page.route(/tesseract|tessdata/, (route) => route.abort());

  await page.route("**/api/catalog/lookup", async (route) => {
    backend.lookups.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true, data: SCANNED } });
  });

  await page.route(`${SUPABASE}/auth/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/token")) return route.fulfill({ json: sessionBody() });
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: userBody() });
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204 });
    return route.fulfill({ status: 404, json: {} });
  });

  await page.route(`${SUPABASE}/storage/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    backend.writes.push(route.request());
    const key = url.pathname.replace("/storage/v1/object/", "");
    await route.fulfill({ json: { Key: key, Id: "e2e-file" } });
  });

  await page.route(`${SUPABASE}/rest/v1/items**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();

    if (method === "GET") {
      let rows = backend.items;
      const userFilter = url.searchParams.get("user_id");
      if (userFilter?.startsWith("eq.")) rows = rows.filter((r) => r.user_id === userFilter.slice(3));
      const catFilter = url.searchParams.get("category");
      if (catFilter?.startsWith("eq.")) rows = rows.filter((r) => r.category === catFilter.slice(3));
      return route.fulfill({ json: rows });
    }

    backend.writes.push(req);

    if (method === "POST") {
      const body = req.postDataJSON();
      const row = Array.isArray(body) ? body[0] : body;
      backend.inserts.push(row);
      const created = makeItem({
        ...row,
        id: `new-${backend.inserts.length}`,
        created_at: new Date().toISOString(),
      });
      backend.items.unshift(created);
      const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
      return route.fulfill({ status: 201, json: single ? created : [created] });
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "") ?? "";
      backend.deletes.push(id);
      backend.items = backend.items.filter((r) => r.id !== id);
      return route.fulfill({ status: 204 });
    }

    return route.fulfill({ status: 405, json: {} });
  });

  return backend;
}

/** Loguje przez formularz — token zwraca zamockowany Supabase. */
export async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Adres e-mail").fill(USER_EMAIL);
  await page.getByLabel("Hasło").fill("e2e-test-pass");
  await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
  await expect(page.getByText(USER_EMAIL)).toBeVisible();
}

export const test = base;
export { expect };
