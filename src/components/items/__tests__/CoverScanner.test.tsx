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

vi.mock("@/lib/items/api", () => ({
  searchCommunityItems: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

import { detectBarcodeFromFile } from "@/lib/scan/barcode";
import { recognizeCoverText } from "@/lib/scan/ocr";
import { searchCommunityItems } from "@/lib/items/api";

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

  type FakeResponse = { ok: boolean; json: () => Promise<unknown> };
  const ok = (data: unknown): FakeResponse => ({ ok: true, json: async () => ({ success: true, data }) });
  const fail = (error: string, extra: Record<string, unknown> = {}): FakeResponse => ({
    ok: false,
    json: async () => ({ error, ...extra }),
  });

  /** Routes mocked fetch calls by endpoint; lookup answers are consumed in order. */
  function routeFetch(recognize: FakeResponse | Error, ...lookups: FakeResponse[]) {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url === "/api/catalog/recognize") {
        if (recognize instanceof Error) throw recognize;
        return recognize;
      }
      return lookups.shift() ?? fail("Nie znaleziono metadanych");
    });
  }

  const lookupCalls = () =>
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => url === "/api/catalog/lookup"
    );

  function pickPhoto() {
    fireEvent.change(screen.getByTestId("cover-scan-file-input"), {
      target: { files: [new File(["dummy"], "cover.jpg", { type: "image/jpeg" })] },
    });
  }

  it("recognizes the cover with the vision API when no barcode is found", async () => {
    const onScanComplete = vi.fn();
    const recognized = {
      title: "Gruby Brzuch",
      artist_creator: "Grubson",
      category: "music",
      subcategory: "Winyl",
      cover_url: null,
      metadata: { source: "gemini" },
    };
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    routeFetch(ok(recognized));

    render(<CoverScanner onScanComplete={onScanComplete} />);
    pickPhoto();

    await waitFor(() => {
      expect(onScanComplete).toHaveBeenCalledWith({
        ...recognized,
        previewUrl: "data:image/jpeg;base64,mockCompressedBase64",
      });
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/catalog/recognize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "data:image/jpeg;base64,mockCompressedBase64" }),
    });
    expect(recognizeCoverText).not.toHaveBeenCalled();
  });

  it("falls back to OCR when the vision API is overloaded (503)", async () => {
    const onScanComplete = vi.fn();
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recognizeCoverText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      query: "MARVEL SPIDER-MAN INSOMNIAC",
      category: "game",
      subcategory: "PS4",
    });
    routeFetch(
      fail("Usługa rozpoznawania obrazu jest chwilowo niedostępna.", { unavailable: true }),
      ok({
        title: "Marvel's Spider-Man",
        artist_creator: "Insomniac Games",
        category: "game",
        subcategory: "PlayStation 5",
        cover_url: null,
        metadata: {},
      })
    );

    render(<CoverScanner onScanComplete={onScanComplete} />);
    pickPhoto();

    await waitFor(() => {
      expect(onScanComplete).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Marvel's Spider-Man", category: "game", subcategory: "PS4" })
      );
    });
    expect(lookupCalls()[0][1].body).toBe(
      JSON.stringify({ query: "MARVEL SPIDER-MAN INSOMNIAC", category: "game" })
    );
  });

  it("falls back to OCR when the vision API is unreachable", async () => {
    const onScanComplete = vi.fn();
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recognizeCoverText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      query: "Wiedźmin Andrzej Sapkowski",
    });
    routeFetch(
      new TypeError("Failed to fetch"),
      ok({
        title: "Wiedźmin",
        artist_creator: "Andrzej Sapkowski",
        category: "book",
        subcategory: null,
        cover_url: null,
        metadata: {},
      })
    );

    render(<CoverScanner onScanComplete={onScanComplete} />);
    pickPhoto();

    await waitFor(() => expect(onScanComplete).toHaveBeenCalled());
    expect(lookupCalls()[0][1].body).toBe(JSON.stringify({ query: "Wiedźmin Andrzej Sapkowski" }));
  });

  it("shows OCR text for manual correction when lookup finds nothing", async () => {
    const onScanComplete = vi.fn();
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recognizeCoverText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      query: "MAN INSOMNIAC",
    });
    routeFetch(
      fail("Nie udało się rozpoznać okładki."),
      fail("Nie znaleziono metadanych w darmowych bazach katalogowych."),
      ok({
        title: "Marvel's Spider-Man",
        artist_creator: "Insomniac Games",
        category: "game",
        subcategory: "PlayStation 4",
        cover_url: null,
        metadata: {},
      })
    );

    render(<CoverScanner onScanComplete={onScanComplete} />);
    pickPhoto();

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

  it("shows an empty manual search field when vision and OCR both fail", async () => {
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recognizeCoverText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ query: "" });
    routeFetch(fail("niedostępna", { unavailable: true }));

    render(<CoverScanner onScanComplete={vi.fn()} onError={vi.fn()} />);
    pickPhoto();

    expect(await screen.findByLabelText(/Popraw odczytany tekst/i)).toHaveValue("");
    expect(lookupCalls()).toHaveLength(0);
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

  it("opens the community search pop-up with the OCR text when nothing is found", async () => {
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recognizeCoverText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ query: "GRUBY" });
    routeFetch(fail("Limit wyczerpany", { unavailable: true }), fail("Nie znaleziono metadanych"));

    render(<CoverScanner onScanComplete={vi.fn()} onError={vi.fn()} />);
    pickPhoto();

    expect(await screen.findByRole("dialog", { name: /wpisach innych użytkowników/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Tytuł lub twórca/i)).toHaveValue("GRUBY");
    expect(searchCommunityItems).toHaveBeenCalledWith("GRUBY");
  });

  it("fills the form from an item picked in the pop-up, keeping the photo as fallback cover", async () => {
    const onScanComplete = vi.fn();
    const picked = {
      title: "Gruby Brzuch",
      artist_creator: "Grubson",
      category: "music",
      subcategory: "CD",
      cover_url: null,
      metadata: { year: "2012" },
    };
    (searchCommunityItems as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [picked],
      error: null,
    });
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recognizeCoverText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ query: "" });
    routeFetch(fail("niedostępna", { unavailable: true }));

    render(<CoverScanner onScanComplete={onScanComplete} onError={vi.fn()} />);
    pickPhoto();

    fireEvent.change(await screen.findByLabelText(/Tytuł lub twórca/i), {
      target: { value: "Gruby" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Szukaj w kolekcjach/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Gruby Brzuch/i }));

    expect(onScanComplete).toHaveBeenCalledWith({
      ...picked,
      previewUrl: "data:image/jpeg;base64,mockCompressedBase64",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Popraw odczytany tekst/i)).not.toBeInTheDocument();
  });

  it("reopens the pop-up when the corrected catalog search also finds nothing", async () => {
    (detectBarcodeFromFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (recognizeCoverText as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ query: "" });
    routeFetch(fail("niedostępna", { unavailable: true }), fail("Nie znaleziono metadanych"));

    render(<CoverScanner onScanComplete={vi.fn()} onError={vi.fn()} />);
    pickPhoto();

    fireEvent.click(await screen.findByRole("button", { name: /Zamknij/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Popraw odczytany tekst/i), {
      target: { value: "Solaris" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Szukaj$/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tytuł lub twórca/i)).toHaveValue("Solaris");
  });
});
