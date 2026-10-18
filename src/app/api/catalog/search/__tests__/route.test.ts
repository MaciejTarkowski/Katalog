import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";

const mockGuard = vi.fn();
vi.mock("@/lib/api/guard", () => ({ guardRequest: (...args: unknown[]) => mockGuard(...args) }));

vi.mock("@/lib/catalog/search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalog/search")>()),
  searchCatalog: vi.fn(),
}));

import { searchCatalog } from "@/lib/catalog/search";

const mockSearch = searchCatalog as unknown as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/catalog/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/catalog/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue(null);
  });

  it("returns client payloads for the found items", async () => {
    mockSearch.mockResolvedValue({ hasMore: true, items: [
      {
        title: "The Dark Side of the Moon",
        artist_creator: "Pink Floyd",
        category: "music",
        subcategory: "Album",
        cover_url: null,
        metadata: { year: "1973" },
        source: "musicbrainz",
      },
    ] });

    const res = await POST(request({ query: " Dark side of the moon " }));
    const json = await res.json();

    expect(mockSearch).toHaveBeenCalledWith("Dark side of the moon", { category: undefined, offset: 0 });
    expect(json.hasMore).toBe(true);
    expect(res.status).toBe(200);
    expect(json.data[0]).toMatchObject({ title: "The Dark Side of the Moon", artist_creator: "Pink Floyd" });
  });

  it("forwards category and offset, ignoring invalid values", async () => {
    mockSearch.mockResolvedValue({ items: [], hasMore: false });

    await POST(request({ query: "mario", category: "game", offset: 40 }));
    expect(mockSearch).toHaveBeenLastCalledWith("mario", { category: "game", offset: 40 });

    await POST(request({ query: "mario", categories: ["game", "bogus", "book"] }));
    expect(mockSearch).toHaveBeenLastCalledWith("mario", { category: undefined, categories: ["game", "book"], offset: 0 });

    await POST(request({ query: "mario", category: "bogus", offset: -3 }));
    expect(mockSearch).toHaveBeenLastCalledWith("mario", { category: undefined, offset: 0 });
  });

  it("rejects an empty query", async () => {
    expect((await POST(request({ query: "  " }))).status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("refuses a visitor the guard turns away, without calling the external API", async () => {
    mockGuard.mockResolvedValue(NextResponse.json({ error: "Zaloguj się" }, { status: 401 }));
    const res = await POST(request({ query: "Solaris" }));
    expect(res.status).toBe(401);
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
