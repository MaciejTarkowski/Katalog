import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/catalog/lookup", () => ({ lookupCatalogItem: vi.fn() }));

import { lookupCatalogItem } from "@/lib/catalog/lookup";

const mockLookup = lookupCatalogItem as unknown as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/catalog/enrich", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/catalog/enrich", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request without a recognized title", async () => {
    expect((await POST(request({ recognized: { category: "book" } }))).status).toBe(400);
    expect((await POST(request({}))).status).toBe(400);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("enriches the recognition with a matching catalog hit, keeping category and platform", async () => {
    mockLookup.mockResolvedValue({
      title: "Marvel's Spider-Man",
      artist_creator: "Insomniac Games",
      category: "game",
      subcategory: "PlayStation 5",
      cover_url: "https://media.rawg.io/spiderman.jpg",
      metadata: { year: "2018", platform: "PlayStation 5" },
      source: "rawg",
    });

    const json = await (
      await POST(
        request({
          recognized: { title: "Marvel's Spider-Man", creator: "Insomniac Games", category: "game", subcategory: "PS4" },
        })
      )
    ).json();

    expect(mockLookup).toHaveBeenCalledWith({
      query: "Marvel's Spider-Man Insomniac Games",
      title: "Marvel's Spider-Man",
      creator: "Insomniac Games",
      category: "game",
    });
    expect(json.data).toMatchObject({
      title: "Marvel's Spider-Man",
      category: "game",
      subcategory: "PS4",
      cover_url: "https://media.rawg.io/spiderman.jpg",
      metadata: { year: "2018", platform: "PS4", source: "gemini+rawg" },
    });
  });

  it("ignores a catalog hit with a different title", async () => {
    mockLookup.mockResolvedValue({
      title: "Kasacja",
      artist_creator: "Remigiusz Mróz",
      category: "book",
      subcategory: null,
      cover_url: "https://covers.openlibrary.org/b/id/1-L.jpg",
      metadata: { year: "2015" },
      source: "openlibrary",
    });

    const json = await (
      await POST(request({ recognized: { title: "Szepty spoza nicości", creator: "Remigiusz Mróz", category: "book", subcategory: null } }))
    ).json();

    expect(json.data).toEqual({
      title: "Szepty spoza nicości",
      artist_creator: "Remigiusz Mróz",
      category: "book",
      subcategory: null,
      cover_url: null,
      metadata: { source: "gemini" },
    });
  });

  it("returns the recognition unchanged when no catalog has it or the lookup fails", async () => {
    mockLookup.mockRejectedValue(new Error("timeout"));
    const json = await (
      await POST(request({ recognized: { title: "Gruby Brzuch", creator: "Grubson", category: "music", subcategory: "Winyl" } }))
    ).json();
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({ title: "Gruby Brzuch", artist_creator: "Grubson", category: "music", cover_url: null });
  });
});
