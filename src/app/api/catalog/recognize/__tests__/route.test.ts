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

  it("answers with the recognition right away, leaving the catalog lookup to /api/catalog/enrich", async () => {
    const recognized = {
      title: "Marvel's Spider-Man",
      creator: "Insomniac Games",
      category: "game",
      subcategory: "PS4",
      box: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    };
    mockRecognize.mockResolvedValue(recognized);

    const res = await POST(request({ image: IMAGE }));
    const json = await res.json();

    expect(mockRecognize).toHaveBeenCalledWith({ mimeType: "image/jpeg", data: "AAAA" });
    expect(mockLookup).not.toHaveBeenCalled();
    expect(json.data).toEqual({
      title: "Marvel's Spider-Man",
      artist_creator: "Insomniac Games",
      category: "game",
      subcategory: "PS4",
      cover_url: null,
      cover_box: recognized.box,
      metadata: { platform: "PS4", source: "gemini" },
    });
    expect(json.recognized).toEqual(recognized);
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
