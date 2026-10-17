import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchItemDescription } from "../description";
import type { Item } from "@/types/database";

const item = {
  id: "1",
  user_id: "u",
  title: "Solaris",
  artist_creator: "Stanisław Lem",
  category: "book",
  subcategory: null,
  cover_url: null,
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
} as Item;

describe("fetchItemDescription", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("asks the description route with the item's title, creator and category", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { description: "Opis.", url: "https://pl.wikipedia.org/wiki/Solaris" } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await fetchItemDescription(item)).toEqual({ description: "Opis.", url: "https://pl.wikipedia.org/wiki/Solaris" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/catalog/description");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ title: "Solaris", creator: "Stanisław Lem", category: "book" });
  });

  it("tells 'no description' (null) apart from a failed lookup (undefined)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: null }) }) as unknown as typeof fetch;
    expect(await fetchItemDescription(item)).toBeNull();

    global.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    expect(await fetchItemDescription(item)).toBeUndefined();
  });
});
