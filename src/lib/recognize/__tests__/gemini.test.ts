import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiUnavailableError, parseGeminiResponse, recognizeCover } from "../gemini";

const image = { data: "AAAA", mimeType: "image/jpeg" };

function geminiAnswer(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  };
}

function status(code: number) {
  return { ok: false, status: code, json: async () => ({ error: { code } }) };
}

describe("recognizeCover", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModels = process.env.GEMINI_MODELS;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.GEMINI_MODELS = "model-a,model-b";
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalKey;
    process.env.GEMINI_MODELS = originalModels;
  });

  it.each([
    [
      "gra.jpeg",
      { title: "Marvel's Spider-Man", creator: "Insomniac Games", category: "game", subcategory: "PS4" },
    ],
    [
      "ksiazka.jpeg",
      { title: "Szepty spoza nicości", creator: "Remigiusz Mróz", category: "book", subcategory: null },
    ],
    [
      "muzyka.jpeg",
      { title: "Gruby Brzuch", creator: "Grubson", category: "music", subcategory: "Winyl" },
    ],
  ])("parses the recognition for %s", async (_name, answer) => {
    fetchMock.mockResolvedValueOnce(geminiAnswer(answer));
    await expect(recognizeCover(image, { retryDelayMs: 0 })).resolves.toEqual(answer);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/models/model-a:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("test-gemini-key");
    expect(JSON.parse(init.body).contents[0].parts[0].inlineData).toEqual(image);
  });

  it("retries a 503 and then falls back to the next model", async () => {
    fetchMock
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(
        geminiAnswer({ title: "Gruby Brzuch", creator: "Grubson", category: "music" })
      );

    const result = await recognizeCover(image, { retryDelayMs: 0 });

    expect(result?.title).toBe("Gruby Brzuch");
    expect(fetchMock.mock.calls.map(([url]) => url.match(/models\/([^:]+)/)[1])).toEqual([
      "model-a",
      "model-a",
      "model-b",
    ]);
  });

  it("treats network errors like overload", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(geminiAnswer({ title: "Spider-Man", category: "game" }));

    await expect(recognizeCover(image, { retryDelayMs: 0 })).resolves.toMatchObject({
      title: "Spider-Man",
    });
  });

  it("throws GeminiUnavailableError when every model is overloaded", async () => {
    fetchMock.mockResolvedValue(status(503));
    await expect(recognizeCover(image, { retryDelayMs: 0 })).rejects.toBeInstanceOf(
      GeminiUnavailableError
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("skips a model that does not exist without retrying it", async () => {
    fetchMock
      .mockResolvedValueOnce(status(404))
      .mockResolvedValueOnce(geminiAnswer({ title: "Spider-Man", category: "game" }));

    await recognizeCover(image, { retryDelayMs: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws GeminiUnavailableError without an API key", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(recognizeCover(image)).rejects.toBeInstanceOf(GeminiUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("parseGeminiResponse", () => {
  const wrap = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

  it("returns null for invalid JSON or a missing title", () => {
    expect(parseGeminiResponse(wrap("not json"))).toBeNull();
    expect(parseGeminiResponse(wrap(JSON.stringify({ title: " ", category: "book" })))).toBeNull();
    expect(parseGeminiResponse({})).toBeNull();
  });

  it.each(["brak", "Brak", "BRAK DANYCH", "nieznany", "Nieznany tytuł", "unknown", "N/A", "-"])(
    "returns null when the title is a placeholder (%s)",
    (title) => {
      expect(parseGeminiResponse(wrap(JSON.stringify({ title, category: "music" })))).toBeNull();
    }
  );

  it("returns null when the model says it did not recognize the item", () => {
    expect(
      parseGeminiResponse(wrap(JSON.stringify({ recognized: false, title: "Okładka płyty", category: "music" })))
    ).toBeNull();
  });

  it("drops placeholder creator and subcategory but keeps the title", () => {
    expect(
      parseGeminiResponse(
        wrap(JSON.stringify({ recognized: true, title: "Solaris", creator: "brak", category: "book", subcategory: "Brak" }))
      )
    ).toEqual({ title: "Solaris", creator: null, category: "book", subcategory: null });
  });

  it("maps an unknown category to other", () => {
    expect(
      parseGeminiResponse(wrap(JSON.stringify({ title: "X", category: "toy" })))?.category
    ).toBe("other");
  });
});
