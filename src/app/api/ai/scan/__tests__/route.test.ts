import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      };
    },
    Type: {
      OBJECT: "OBJECT",
      STRING: "STRING",
    },
  };
});

describe("POST /api/ai/scan", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-real-gemini-key";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
  });

  it("returns 500 when GEMINI_API_KEY is not configured", async () => {
    delete process.env.GEMINI_API_KEY;

    const req = new NextRequest("http://localhost:3000/api/ai/scan", {
      method: "POST",
      body: JSON.stringify({ imageBase64: "dummyBase64" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toContain("GEMINI_API_KEY");
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/ai/scan", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain("imageBase64");
  });

  it("returns parsed item data on successful AI analysis", async () => {
    const aiOutput = {
      title: "Władca Pierścieni",
      artist_creator: "J.R.R. Tolkien",
      category: "book",
      subcategory: "Fantasy",
      metadata: { year: "1954", publisher: "Allen & Unwin" },
    };

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(aiOutput),
    });

    const req = new NextRequest("http://localhost:3000/api/ai/scan", {
      method: "POST",
      body: JSON.stringify({ imageBase64: "validBase64Image" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.title).toBe("Władca Pierścieni");
    expect(json.data.artist_creator).toBe("J.R.R. Tolkien");
    expect(json.data.category).toBe("book");
    expect(json.data.subcategory).toBe("Fantasy");
    expect(json.data.metadata.year).toBe("1954");
  });

  it("handles model error gracefully", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Gemini quota exceeded"));

    const req = new NextRequest("http://localhost:3000/api/ai/scan", {
      method: "POST",
      body: JSON.stringify({ imageBase64: "validBase64Image" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe("Gemini quota exceeded");
  });
  it("returns 502 when Gemini returns non-JSON response", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "Przepraszam, nie mogę rozpoznać tego przedmiotu.",
    });

    const req = new NextRequest("http://localhost:3000/api/ai/scan", {
      method: "POST",
      body: JSON.stringify({ imageBase64: "validBase64Image" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(502);

    const json = await res.json();
    expect(json.error).toContain("nieprawidłowy format JSON");
  });
});
