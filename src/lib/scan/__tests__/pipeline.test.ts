import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/image/compress", () => ({
  compressImage: vi.fn(async () => ({ dataUrl: "data:image/jpeg;base64,AAAA" })),
}));
vi.mock("@/lib/scan/barcode", () => ({ detectBarcodeFromFile: vi.fn(async () => null) }));
vi.mock("@/lib/image/crop", () => ({ cropImage: vi.fn(async () => "data:image/jpeg;base64,CROPPED") }));
vi.mock("@/lib/scan/ocr", () => ({ recognizeCoverText: vi.fn() }));

import { recognizeCoverText } from "@/lib/scan/ocr";
import { cropImage } from "@/lib/image/crop";
import { ScanError, scanCoverFile } from "../pipeline";

const mockOcr = recognizeCoverText as unknown as ReturnType<typeof vi.fn>;
const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });

function reply(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body };
}

describe("scanCoverFile", () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws ScanError when the cover is not recognized and OCR finds no text", async () => {
    fetchMock.mockResolvedValueOnce(reply(404, { error: "Nie udało się rozpoznać okładki." }));
    mockOcr.mockResolvedValue({ query: "" });

    const err = await scanCoverFile(file, () => {}).catch((e) => e);
    expect(err).toBeInstanceOf(ScanError);
    expect(err.previewUrl).toBe("data:image/jpeg;base64,AAAA");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws ScanError with the OCR text when the catalogs find nothing", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(404, { error: "Nie udało się rozpoznać okładki." }))
      .mockResolvedValueOnce(reply(404, { error: "Nie znaleziono metadanych w darmowych bazach katalogowych." }));
    mockOcr.mockResolvedValue({ query: "SOLARIS LEM" });

    const err = await scanCoverFile(file, () => {}).catch((e) => e);
    expect(err).toBeInstanceOf(ScanError);
    expect(err.query).toBe("SOLARIS LEM");
  });

  it("crops the preview to the cover when the recognition returns its box", async () => {
    const box = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    fetchMock.mockResolvedValueOnce(
      reply(200, { success: true, data: { title: "Solaris", artist_creator: null, category: "book", subcategory: null, cover_url: null, metadata: {}, cover_box: box } })
    );
    const data = await scanCoverFile(file, () => {});
    expect(cropImage).toHaveBeenCalledWith("data:image/jpeg;base64,AAAA", box);
    expect(data.previewUrl).toBe("data:image/jpeg;base64,CROPPED");
  });

  it("keeps the full photo when there is no box or cropping fails", async () => {
    fetchMock.mockResolvedValue(
      reply(200, { success: true, data: { title: "Solaris", artist_creator: null, category: "book", subcategory: null, cover_url: null, metadata: {} } })
    );
    expect((await scanCoverFile(file, () => {})).previewUrl).toBe("data:image/jpeg;base64,AAAA");

    (cropImage as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("canvas"));
    fetchMock.mockResolvedValue(
      reply(200, { success: true, data: { title: "Solaris", artist_creator: null, category: "book", subcategory: null, cover_url: null, metadata: {}, cover_box: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } } })
    );
    expect((await scanCoverFile(file, () => {})).previewUrl).toBe("data:image/jpeg;base64,AAAA");
  });
});
