import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/catalog/lookup", () => ({ lookupCatalogItem: vi.fn() }));
vi.mock("@/lib/recognize/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/recognize/gemini")>()),
  recognizeCover: vi.fn(),
}));

import { lookupCatalogItem } from "@/lib/catalog/lookup";
import { GeminiUnavailableError, recognizeCover } from "@/lib/recognize/gemini";

const mockLookup = lookupCatalogItem as unknown as ReturnType<typeof vi.fn>;
const mockRecognize = recognizeCover as unknown as ReturnType<typeof vi.fn>;
const IMAGE = "data:image/jpeg;base64,AAAA";

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/catalog/recognize", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/catalog/recognize", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request without an image", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
    expect(mockRecognize).not.toHaveBeenCalled();
  });

  it("enriches the recognition with a matching catalog hit, keeping category and platform", async () => {
    mockRecognize.mockResolvedValue({
      title: "Marvel's Spider-Man",
      creator: "Insomniac Games",
      category: "game",
      subcategory: "PS4",
    });
    mockLookup.mockResolvedValue({
      title: "Marvel's Spider-Man",
      artist_creator: "Insomniac Games",
      category: "game",
      subcategory: "PlayStation 5",
      cover_url: "https://media.rawg.io/spiderman.jpg",
      metadata: { year: "2018", platform: "PlayStation 5" },
      source: "rawg",
    });

    const res = await POST(request({ image: IMAGE }));
    const json = await res.json();

    expect(mockRecognize).toHaveBeenCalledWith({ mimeType: "image/jpeg", data: "AAAA" });
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
    mockRecognize.mockResolvedValue({
      title: "Szepty spoza nicości",
      creator: "Remigiusz Mróz",
      category: "book",
      subcategory: null,
    });
    mockLookup.mockResolvedValue({
      title: "Kasacja",
      artist_creator: "Remigiusz Mróz",
      category: "book",
      subcategory: null,
      cover_url: "https://covers.openlibrary.org/b/id/1-L.jpg",
      metadata: { year: "2015" },
      source: "openlibrary",
    });

    const json = await (await POST(request({ image: IMAGE }))).json();

    expect(json.data).toEqual({
      title: "Szepty spoza nicości",
      artist_creator: "Remigiusz Mróz",
      category: "book",
      subcategory: null,
      cover_url: null,
      metadata: { source: "gemini" },
    });
  });

  it("returns the recognition when no catalog has it", async () => {
    mockRecognize.mockResolvedValue({
      title: "Gruby Brzuch",
      creator: "Grubson",
      category: "music",
      subcategory: "Winyl",
    });
    mockLookup.mockResolvedValue(null);

    const json = await (await POST(request({ image: IMAGE }))).json();
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({ title: "Gruby Brzuch", artist_creator: "Grubson", category: "music" });
  });

  it("answers 503 with unavailable flag when Gemini is overloaded", async () => {
    mockRecognize.mockRejectedValue(new GeminiUnavailableError());

    const res = await POST(request({ image: IMAGE }));
    expect(res.status).toBe(503);
    expect((await res.json()).unavailable).toBe(true);
  });

  it("answers 404 when the cover could not be identified", async () => {
    mockRecognize.mockResolvedValue(null);
    expect((await POST(request({ image: IMAGE }))).status).toBe(404);
  });
});
