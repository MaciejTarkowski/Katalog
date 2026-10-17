import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/catalog/providers/wikipedia", () => ({ findWikipediaDescription: vi.fn() }));

import { findWikipediaDescription } from "@/lib/catalog/providers/wikipedia";

const mockFind = findWikipediaDescription as unknown as ReturnType<typeof vi.fn>;
const request = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/catalog/description", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/catalog/description", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request without a title", async () => {
    expect((await POST(request({ category: "book" }))).status).toBe(400);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("returns the description found for the item", async () => {
    mockFind.mockResolvedValue({ description: "Opis.", url: "https://pl.wikipedia.org/wiki/Solaris" });
    const json = await (await POST(request({ title: "Solaris", creator: "Stanisław Lem", category: "book" }))).json();
    expect(mockFind).toHaveBeenCalledWith({ title: "Solaris", creator: "Stanisław Lem", category: "book" });
    expect(json).toEqual({ success: true, data: { description: "Opis.", url: "https://pl.wikipedia.org/wiki/Solaris" } });
  });

  it("answers with null data when there is no description", async () => {
    mockFind.mockResolvedValue(null);
    const json = await (await POST(request({ title: "X", category: "game" }))).json();
    expect(json).toEqual({ success: true, data: null });
  });
});
