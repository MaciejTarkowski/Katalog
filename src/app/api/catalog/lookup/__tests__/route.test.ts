import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/catalog/lookup", () => ({
  lookupCatalogItem: vi.fn(),
  toClientPayload: (item: {
    title: string;
    artist_creator: string | null;
    category: string;
    subcategory: string | null;
    cover_url: string | null;
    metadata: Record<string, unknown>;
    source: string;
  }) => ({
    title: item.title,
    artist_creator: item.artist_creator,
    category: item.category,
    subcategory: item.subcategory,
    cover_url: item.cover_url,
    metadata: { ...item.metadata, source: item.source },
  }),
}));

import { lookupCatalogItem } from "@/lib/catalog/lookup";

const mockLookup = lookupCatalogItem as unknown as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/catalog/lookup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/catalog/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when ean and query are missing", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("ean");
  });

  it("returns 400 for an invalid EAN", async () => {
    const res = await POST(request({ ean: "abc" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("nieprawidłowy");
  });

  it("returns metadata for a valid EAN", async () => {
    mockLookup.mockResolvedValue({
      title: "The Hobbit",
      artist_creator: "J.R.R. Tolkien",
      category: "book",
      subcategory: null,
      cover_url: "https://covers.openlibrary.org/b/isbn/9780261102217-L.jpg",
      metadata: { year: "1937", isbn: "9780261102217" },
      source: "openlibrary",
    });

    const res = await POST(request({ ean: "9780261102217" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.title).toBe("The Hobbit");
    expect(json.data.cover_url).toContain("openlibrary");
    expect(json.data.metadata.year).toBe("1937");
  });

  it("accepts OCR query text", async () => {
    mockLookup.mockResolvedValue({
      title: "Wiedźmin",
      artist_creator: "Andrzej Sapkowski",
      category: "book",
      subcategory: null,
      cover_url: null,
      metadata: { year: "1993" },
      source: "openlibrary",
    });

    const res = await POST(request({ query: "Wiedźmin Sapkowski" }));
    expect(res.status).toBe(200);
    expect(mockLookup).toHaveBeenCalledWith({
      ean: undefined,
      query: "Wiedźmin Sapkowski",
      category: undefined,
    });
  });

  it("returns 404 when nothing is found", async () => {
    mockLookup.mockResolvedValue(null);
    const res = await POST(request({ query: "unknown" }));
    expect(res.status).toBe(404);
  });
});
