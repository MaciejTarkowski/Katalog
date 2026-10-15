import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddScreen } from "../AddScreen";

const mockScan = vi.fn();
const mockLookup = vi.fn();
const mockCommunity = vi.fn();
const mockUpload = vi.fn();

// The scan pipeline (Gemini, OCR, catalogs) is always mocked.
vi.mock("@/lib/scan/pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scan/pipeline")>();
  return {
    ...actual,
    scanCoverFile: (...args: unknown[]) => mockScan(...args),
    lookupMetadata: (...args: unknown[]) => mockLookup(...args),
  };
});
vi.mock("@/lib/items/api", () => ({
  searchCommunityItems: (q: string) => mockCommunity(q),
}));
vi.mock("@/lib/storage/upload", () => ({
  uploadCoverImage: (url: string) => mockUpload(url),
}));

const SOLARIS = {
  title: "Solaris",
  artist_creator: "Stanisław Lem",
  category: "book",
  subcategory: "miękka oprawa",
  cover_url: null,
  metadata: { year: 1961 },
  previewUrl: "data:image/jpeg;base64,AAAA",
};

function pickFile() {
  const input = screen.getByTestId("cover-scan-file-input");
  fireEvent.change(input, { target: { files: [new File(["x"], "cover.jpg", { type: "image/jpeg" })] } });
}

describe("AddScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ publicUrl: "https://cdn.example/solaris.jpg", error: null });
    mockCommunity.mockResolvedValue({ data: [], error: null });
    mockLookup.mockRejectedValue(new Error("Brak wyników"));
  });

  it("scans a cover and adds the found item, uploading the photo as cover", async () => {
    mockScan.mockResolvedValue(SOLARIS);
    const onAdd = vi.fn().mockResolvedValue(true);
    const onToast = vi.fn();
    render(<AddScreen onAdd={onAdd} onToast={onToast} />);

    expect(screen.getByText("Dotknij, aby zeskanować okładkę")).toBeInTheDocument();
    pickFile();

    expect(await screen.findByRole("heading", { name: "Solaris" })).toBeInTheDocument();
    expect(screen.getByText("Książka · miękka oprawa")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dodaj do kolekcji" }));
    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        title: "Solaris",
        artist_creator: "Stanisław Lem",
        category: "book",
        subcategory: "miękka oprawa",
        cover_url: "https://cdn.example/solaris.jpg",
        metadata: { year: 1961 },
      })
    );
    expect(mockUpload).toHaveBeenCalledWith(SOLARIS.previewUrl);
    expect(onToast).toHaveBeenCalledWith("Dodano „Solaris” do kolekcji");
    expect(await screen.findByText("Dotknij, aby zeskanować okładkę")).toBeInTheDocument();
  });

  it("shows an error and keeps the item when saving fails", async () => {
    mockScan.mockResolvedValue({ ...SOLARIS, cover_url: "https://covers.example/s.jpg" });
    const onAdd = vi.fn().mockResolvedValue(false);
    render(<AddScreen onAdd={onAdd} onToast={vi.fn()} />);
    pickFile();

    fireEvent.click(await screen.findByRole("button", { name: "Dodaj do kolekcji" }));
    expect(await screen.findByText("Nie udało się zapisać elementu.")).toBeInTheDocument();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Solaris" })).toBeInTheDocument();
  });

  it("opens the reject sheet with rescan and text search options", async () => {
    mockScan.mockResolvedValue(SOLARIS);
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);
    pickFile();

    fireEvent.click(await screen.findByRole("button", { name: "Odrzuć" }));
    expect(screen.getByRole("dialog", { name: "Nie ta pozycja?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zeskanuj ponownie/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Wpisz tytuł/ }));
    expect(screen.getByRole("dialog", { name: "Wyszukaj tytuł" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Tytuł lub twórca" })).toHaveValue("Solaris");
  });

  it("falls back to text search with the OCR text when nothing is recognized", async () => {
    const { ScanError } = await import("@/lib/scan/pipeline");
    mockScan.mockRejectedValue(new ScanError("Nie udało się pobrać metadanych.", "SOLARIS LEM"));
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);
    pickFile();

    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się pobrać metadanych.");
    expect(screen.getByRole("dialog", { name: "Wyszukaj tytuł" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Tytuł lub twórca" })).toHaveValue("SOLARIS LEM");
  });

  it("searches catalogs and other users' items, then adds the picked one", async () => {
    mockLookup.mockResolvedValue({ ...SOLARIS, previewUrl: undefined, cover_url: "https://covers.example/s.jpg" });
    mockCommunity.mockResolvedValue({
      data: [{ title: "Cyberiada", artist_creator: "Stanisław Lem", category: "book", subcategory: null, cover_url: null, metadata: {} }],
      error: null,
    });
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /lub wpisz tytuł/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Tytuł lub twórca" }), { target: { value: "lem" } });

    const pick = await screen.findByRole("button", { name: /Cyberiada/ });
    expect(mockLookup).toHaveBeenCalledWith({ query: "lem" });
    expect(mockCommunity).toHaveBeenCalledWith("lem");
    expect(screen.getByText("2 wpisy w katalogach i kolekcjach")).toBeInTheDocument();

    const plus = screen.getByRole("button", { name: "Dodaj wybraną pozycję" });
    expect(plus).toBeDisabled();
    fireEvent.click(pick);
    expect(screen.getByText("Wybrano: Cyberiada")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(plus);
    });
    expect(await screen.findByRole("heading", { name: "Cyberiada" }, { timeout: 3000 })).toBeInTheDocument();
  });
});
