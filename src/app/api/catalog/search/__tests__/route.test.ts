import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/catalog/search", () => ({ searchCatalog: vi.fn() }));

import { searchCatalog } from "@/lib/catalog/search";

const mockSearch = searchCatalog as unknown as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/catalog/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/catalog/search", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns client payloads for the found items", async () => {
    mockSearch.mockResolvedValue([
      {
        title: "The Dark Side of the Moon",
        artist_creator: "Pink Floyd",
        category: "music",
        subcategory: "Album",
        cover_url: null,
        metadata: { year: "1973" },
        source: "musicbrainz",
      },
    ]);

    const res = await POST(request({ query: " Dark side of the moon " }));
    const json = await res.json();

    expect(mockSearch).toHaveBeenCalledWith("Dark side of the moon");
    expect(res.status).toBe(200);
    expect(json.data[0]).toMatchObject({ title: "The Dark Side of the Moon", artist_creator: "Pink Floyd" });
  });

  it("rejects an empty query", async () => {
    expect((await POST(request({ query: "  " }))).status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
