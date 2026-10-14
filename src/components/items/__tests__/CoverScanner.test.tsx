import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoverScanner } from "../CoverScanner";

vi.mock("@/lib/image/compress", () => ({
  compressImage: vi.fn().mockResolvedValue({
    base64: "mockCompressedBase64",
    mimeType: "image/jpeg",
    dataUrl: "data:image/jpeg;base64,mockCompressedBase64",
    width: 800,
    height: 600,
  }),
}));

vi.mock("@/lib/scan/barcode", () => ({
  detectBarcodeFromFile: vi.fn(),
  startLiveBarcodeScan: vi.fn(),
}));

vi.mock("@/lib/scan/ocr", () => ({
  recognizeCoverText: vi.fn(),
}));

import { detectBarcodeFromFile } from "@/lib/scan/barcode";
import { recognizeCoverText } from "@/lib/scan/ocr";

describe("CoverScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders a single scan button", () => {
    render(<CoverScanner onScanComplete={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Zeskanuj okładkę/i })).toBeInTheDocument();
  });

  it("opens the photo picker from the scan button", () => {
    render(<CoverScanner onScanComplete={vi.fn()} />);
    const input = screen.getByTestId("cover-scan-file-input") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: /Zeskanuj okładkę/i }));
    expect(click).toHaveBeenCalled();
  });

  it("looks up metadata from a barcode found on a photo", async () => {
    const onScanComplete = vi.fn();
    const mockData = {
      title: "The Hobbit",
      artist_creator: "J.R.R. Tolkien",
      category: "book",
      subcategory: null,
      cover_url: "https://covers.openlibrary.org/b/isbn/9780261102217-L.jpg",
      metadata: { year: "1937", source: "openlibrary" },
    };

    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      "9780261102217"
    );
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    });

    render(<CoverScanner onScanComplete={onScanComplete} />);

    const input = screen.getByTestId("cover-scan-file-input");
    const file = new File(["dummy"], "cover.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/catalog/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ean: "9780261102217" }),
      });
      expect(onScanComplete).toHaveBeenCalledWith({
        ...mockData,
        previewUrl: "data:image/jpeg;base64,mockCompressedBase64",
      });
    });
    expect(recognizeCoverText).not.toHaveBeenCalled();
  });

  it("falls back to OCR when no barcode is found", async () => {
    const onScanComplete = vi.fn();
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recognizeCoverText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      "Wiedźmin Andrzej Sapkowski"
    );
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          title: "Wiedźmin",
          artist_creator: "Andrzej Sapkowski",
          category: "book",
          subcategory: null,
          cover_url: null,
          metadata: {},
        },
      }),
    });

    render(<CoverScanner onScanComplete={onScanComplete} />);
    fireEvent.change(screen.getByTestId("cover-scan-file-input"), {
      target: { files: [new File(["dummy"], "cover.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => {
      expect(recognizeCoverText).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith("/api/catalog/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Wiedźmin Andrzej Sapkowski" }),
      });
      expect(onScanComplete).toHaveBeenCalled();
    });
  });


  it("shows OCR text for manual correction when lookup finds nothing", async () => {
    const onScanComplete = vi.fn();
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recognizeCoverText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("MAN INSOMNIAC");
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Nie znaleziono metadanych w darmowych bazach katalogowych." }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            title: "Marvel's Spider-Man",
            artist_creator: "Insomniac Games",
            category: "game",
            subcategory: "PlayStation 4",
            cover_url: null,
            metadata: {},
          },
        }),
      });

    render(<CoverScanner onScanComplete={onScanComplete} />);
    fireEvent.change(screen.getByTestId("cover-scan-file-input"), {
      target: { files: [new File(["dummy"], "cover.jpg", { type: "image/jpeg" })] },
    });

    const input = await screen.findByLabelText(/Popraw odczytany tekst/i);
    expect(input).toHaveValue("MAN INSOMNIAC");

    fireEvent.change(input, { target: { value: "Spider-Man" } });
    fireEvent.click(screen.getByRole("button", { name: /^Szukaj$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith("/api/catalog/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Spider-Man" }),
      });
      expect(onScanComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Marvel's Spider-Man",
          previewUrl: "data:image/jpeg;base64,mockCompressedBase64",
        })
      );
    });
    expect(screen.queryByLabelText(/Popraw odczytany tekst/i)).not.toBeInTheDocument();
  });

  it("shows an empty manual search field when OCR reads nothing", async () => {
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recognizeCoverText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("");

    render(<CoverScanner onScanComplete={vi.fn()} onError={vi.fn()} />);
    fireEvent.change(screen.getByTestId("cover-scan-file-input"), {
      target: { files: [new File(["dummy"], "cover.jpg", { type: "image/jpeg" })] },
    });

    expect(await screen.findByLabelText(/Popraw odczytany tekst/i)).toHaveValue("");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("triggers onError when lookup fails", async () => {
    const onError = vi.fn();
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      "9780261102217"
    );
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "Nie znaleziono metadanych" }),
    });

    render(<CoverScanner onScanComplete={vi.fn()} onError={onError} />);
    fireEvent.change(screen.getByTestId("cover-scan-file-input"), {
      target: { files: [new File(["dummy"], "cover.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("Nie znaleziono metadanych");
    });
  });
});
