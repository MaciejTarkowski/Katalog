import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddScreen } from "../AddScreen";

const mockScan = vi.fn();
const mockLookup = vi.fn();
const mockSearch = vi.fn();
const mockCommunity = vi.fn();
const mockUpload = vi.fn();

// The scan pipeline (Gemini, OCR, catalogs) is always mocked.
vi.mock("@/lib/scan/pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scan/pipeline")>();
  return {
    ...actual,
    scanCoverFile: (...args: unknown[]) => mockScan(...args),
    lookupMetadata: (...args: unknown[]) => mockLookup(...args),
    searchCatalogItems: (...args: unknown[]) => mockSearch(...args),
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

function albums(titles: string[], category = "music") {
  return titles.map((title) => ({
    title,
    artist_creator: "Pink Floyd",
    category,
    subcategory: "Album",
    cover_url: null,
    metadata: {},
  }));
}

describe("AddScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ publicUrl: "https://cdn.example/solaris.jpg", error: null });
    mockCommunity.mockResolvedValue({ data: [], error: null });
    mockLookup.mockRejectedValue(new Error("Brak wyników"));
    mockSearch.mockResolvedValue({ items: [], hasMore: false });
  });

  it("scans a cover and adds the found item, uploading the photo as cover", async () => {
    mockScan.mockResolvedValue(SOLARIS);
    const onAdd = vi.fn().mockResolvedValue(null);
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
    const onAdd = vi.fn().mockResolvedValue("Nie udało się zapisać elementu.");
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
    mockSearch.mockResolvedValue({
      items: [{ ...SOLARIS, previewUrl: undefined, cover_url: "https://covers.example/s.jpg" }],
      hasMore: false,
    });
    mockCommunity.mockResolvedValue({
      data: [{ title: "Cyberiada", artist_creator: "Stanisław Lem", category: "book", subcategory: null, cover_url: null, metadata: {} }],
      error: null,
    });
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /lub wpisz tytuł/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Tytuł lub twórca" }), { target: { value: "lem" } });

    const pick = await screen.findByRole("button", { name: /Cyberiada/ });
    expect(mockSearch).toHaveBeenCalledWith("lem", { category: undefined });
    expect(mockLookup).not.toHaveBeenCalled();
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

  it("lists up to 5 catalog results for a typed title", async () => {
    mockSearch.mockResolvedValue({ items: albums(["Album A", "Album B", "Album C", "Album D", "Album E"]), hasMore: false });
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /lub wpisz tytuł/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Tytuł lub twórca" }), { target: { value: "pink" } });

    expect(await screen.findByRole("button", { name: /Album E/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Album [A-E]/ })).toHaveLength(5);
    expect(screen.getByText("5 wpisów w katalogach i kolekcjach")).toBeInTheDocument();
  });

  it("searches only the chosen category and filters community items by it", async () => {
    mockCommunity.mockResolvedValue({ data: albums(["Cyberiada"], "book"), error: null });
    mockSearch.mockResolvedValue({ items: albums(["Gra A"], "game"), hasMore: false });
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /lub wpisz tytuł/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Gry" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Tytuł lub twórca" }), { target: { value: "gra" } });

    expect(await screen.findByRole("button", { name: /Gra A/ })).toBeInTheDocument();
    expect(mockSearch).toHaveBeenLastCalledWith("gra", { category: "game" });
    expect(screen.queryByRole("button", { name: /Cyberiada/ })).not.toBeInTheDocument();
  });

  it("lets a long title's content scroll so the action buttons stay reachable", async () => {
    const longTitle =
      "Mamo, tato, co ty na to? O opiece, pielęgnacji i rozwoju Waszego maleństwa i jeszcze trochę więcej tekstu, żeby na pewno nie zmieścił się na ekranie";
    mockScan.mockResolvedValue({ ...SOLARIS, title: longTitle });
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);
    pickFile();

    expect(await screen.findByRole("heading", { name: longTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dodaj do kolekcji/ })).toBeInTheDocument();
    expect(screen.getByTestId("add-screen-stage").className).toMatch(/overflow-y-auto/);
  });

  it("keeps the scanning sparkle animation running instead of toggling it on/off", async () => {
    mockScan.mockImplementation(() => new Promise(() => {})); // stays in "scanning"
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);
    pickFile();

    const sparks = await screen.findAllByText("✦");
    expect(sparks.length).toBeGreaterThan(0);
    sparks.forEach((s) => expect(s.style.animation).toContain("kTwinkle"));
  });

  it("restarts the scan shimmer from scratch on every new scan instead of resuming mid-loop", async () => {
    mockScan.mockResolvedValue(SOLARIS);
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);
    pickFile();
    await screen.findByRole("heading", { name: "Solaris" });
    const firstShimmer = screen.getByTestId("stage-shimmer");

    fireEvent.click(screen.getByRole("button", { name: "Odrzuć" }));
    fireEvent.click(screen.getByRole("button", { name: /Zeskanuj ponownie/ }));
    pickFile();

    const secondShimmer = screen.getByTestId("stage-shimmer");
    expect(secondShimmer).not.toBe(firstShimmer);
    await screen.findByRole("heading", { name: "Solaris" }); // let the second scan settle
  });

  it("fades the sparkle field out via its wrapper instead of killing the animation when scanning ends", async () => {
    mockScan.mockResolvedValue(SOLARIS);
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);
    pickFile();
    await screen.findByRole("heading", { name: "Solaris" });

    const sparks = screen.getAllByText("✦");
    sparks.forEach((s) => expect(s.style.animation).toContain("kTwinkle"));
    const wrapper = sparks[0].parentElement!;
    expect(wrapper.style.opacity).toBe("0");
    expect(wrapper.style.transition).toContain("opacity");
  });

  it("loads the next page when the end of the list is reached", async () => {
    let reachEnd: () => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
          reachEnd = () => cb([{ isIntersecting: true }]);
        }
        observe() {}
        disconnect() {}
      }
    );
    mockSearch
      .mockResolvedValueOnce({ items: albums(["Album A", "Album B"]), hasMore: true })
      .mockResolvedValueOnce({ items: albums(["Album C"]), hasMore: false });
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /lub wpisz tytuł/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Tytuł lub twórca" }), { target: { value: "pink" } });
    await screen.findByRole("button", { name: /Album B/ });

    await act(async () => reachEnd());

    expect(await screen.findByRole("button", { name: /Album C/ })).toBeInTheDocument();
    expect(mockSearch).toHaveBeenLastCalledWith("pink", { category: undefined, page: 1 });
    vi.unstubAllGlobals();
  });
});
