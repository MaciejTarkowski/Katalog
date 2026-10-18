import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AddScreen } from "../AddScreen";
import { localizedCategories } from "@/lib/items/display";
import { translate } from "@/lib/i18n/translate";

const mockScan = vi.fn();
const mockComplete = vi.fn();
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
    completeRecognition: (...args: unknown[]) => mockComplete(...args),
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
    expect(screen.getByText("Książka · Miękka oprawa")).toBeInTheDocument();

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
    expect(mockSearch).toHaveBeenCalledWith("lem", { categories: expect.arrayContaining(["book", "music", "game", "comic"]) });
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

  it("with \"All\" searches only the categories kept in the catalog, community items included", async () => {
    mockCommunity.mockResolvedValue({
      data: [...albums(["Cyberiada"], "book"), ...albums(["Gra B"], "game")],
      error: null,
    });
    mockSearch.mockResolvedValue({ items: albums(["Gra A"], "game"), hasMore: false });
    render(
      <AddScreen
        categories={localizedCategories((k, v) => translate("pl", k, v)).filter((c) => c.value === "game")}
        onAdd={vi.fn()}
        onToast={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /lub wpisz tytuł/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Tytuł lub twórca" }), { target: { value: "gra" } });

    expect(await screen.findByRole("button", { name: /Gra A/ })).toBeInTheDocument();
    expect(mockSearch).toHaveBeenLastCalledWith("gra", { categories: ["game"] });
    expect(screen.getByRole("button", { name: /Gra B/ })).toBeInTheDocument();
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

  it("animates the scan line and shimmer with GPU transforms", () => {
    const css = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf8");
    const keyframes = (name: string) => css.match(new RegExp(`@keyframes ${name} \\{(.*)\\}`))?.[1] ?? "";
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);

    // Animating top/background-position runs on the main thread and dropped frames on phones.
    const sweep = screen.getByTestId("stage-scanline-sweep").style.animation;
    const shimmer = screen.getByTestId("stage-shimmer").style.animation;
    for (const anim of [sweep, shimmer]) {
      const body = keyframes(anim.split(" ")[0]);
      expect(body).toContain("transform");
      expect(body).not.toMatch(/\b(top|background-position)\s*:/);
    }
  });

  it("sweeps the scan line along the original 4%–94% path over a fixed-height layer", async () => {
    const css = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf8");
    let finish: (v: unknown) => void = () => {};
    mockScan.mockReturnValue(new Promise((r) => (finish = r)));
    render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);
    pickFile();

    const stage = screen.getByRole("button", { name: "Skanowanie" });
    const sweep = screen.getByTestId("stage-scanline-sweep");
    const line = sweep.firstElementChild as HTMLElement;
    // Safari resolves translateY(%) once when the animation starts — the scan starts while the stage
    // is still growing from the idle circle, so a layer sized by inset-0 stopped short of the bottom.
    // A fixed pixel height equal to the scanning stage keeps the sweep length stable.
    expect(sweep.style.height).toBe(stage.style.height);
    expect(sweep.className).not.toMatch(/\binset-0\b/);
    // Same path as the original `top: 4% → 94%` sweep (video2.mp4): starts at 4%, moves by 90%.
    expect(line.className).toMatch(/\btop-\[4%\]/);
    expect(css).toMatch(/@keyframes kScan \{[^}]*translateY\(0\)[^}]*\}[^}]*translateY\(90%\)/);
    expect(sweep.style.animation).toBe("kScan 1.3s ease-in-out infinite alternate");

    await act(async () => finish(SOLARIS));
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
    expect(mockSearch).toHaveBeenLastCalledWith("pink", { categories: expect.any(Array), page: 1 });
    vi.unstubAllGlobals();
  });
  describe("cover arriving after the title", () => {
    const RECOGNIZED = { title: "Solaris", creator: "Stanisław Lem", category: "book", subcategory: null };
    const CATALOG_COVER = "https://covers.example/solaris.jpg";

    function deferred() {
      let resolve!: (value: unknown) => void;
      const promise = new Promise((r) => (resolve = r));
      return { promise, resolve };
    }

    it("shows the title right away and fills in the catalog cover when it arrives", async () => {
      const pending = deferred();
      mockScan.mockResolvedValue({ ...SOLARIS, recognized: RECOGNIZED });
      mockComplete.mockReturnValue(pending.promise);
      const { container } = render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);
      pickFile();

      expect(await screen.findByRole("heading", { name: "Solaris" })).toBeInTheDocument();
      // Only the shimmer on the tile says the cover is coming — no status text.
      expect(screen.queryByText(/Dociągam/i)).not.toBeInTheDocument();
      expect(screen.getByTestId("stage-shimmer").style.opacity).toBe("1");
      expect(container.querySelector("img")).toBeNull();
      expect(mockComplete).toHaveBeenCalledWith(expect.objectContaining({ recognized: RECOGNIZED }));

      await act(async () => pending.resolve({ ...SOLARIS, cover_url: CATALOG_COVER }));

      await waitFor(() => expect(container.querySelector("img")).toHaveAttribute("src", CATALOG_COVER));
      expect(container.querySelector("img")!.style.animation).toContain("kCoverIn");
      expect(screen.getByTestId("stage-shimmer").style.opacity).toBe("0");
    });

    it("shows the photo when no catalog has a cover", async () => {
      mockScan.mockResolvedValue({ ...SOLARIS, recognized: RECOGNIZED });
      mockComplete.mockResolvedValue(SOLARIS);
      const { container } = render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);
      pickFile();

      await waitFor(() => expect(container.querySelector("img")).toHaveAttribute("src", SOLARIS.previewUrl));
    });

    it("waits for the catalog cover when the item is added before it arrives", async () => {
      const pending = deferred();
      mockScan.mockResolvedValue({ ...SOLARIS, recognized: RECOGNIZED });
      mockComplete.mockReturnValue(pending.promise);
      const onAdd = vi.fn().mockResolvedValue(null);
      render(<AddScreen onAdd={onAdd} onToast={vi.fn()} />);
      pickFile();
      await screen.findByRole("heading", { name: "Solaris" });

      fireEvent.click(screen.getByRole("button", { name: "Dodaj do kolekcji" }));
      expect(await screen.findByText("Zapisywanie...")).toBeInTheDocument();
      expect(onAdd).not.toHaveBeenCalled();

      await act(async () => pending.resolve({ ...SOLARIS, cover_url: CATALOG_COVER }));

      await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ cover_url: CATALOG_COVER })));
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("ignores a late cover from a scan the user already rejected", async () => {
      const first = deferred();
      mockScan.mockResolvedValueOnce({ ...SOLARIS, recognized: RECOGNIZED });
      mockComplete.mockReturnValueOnce(first.promise);
      render(<AddScreen onAdd={vi.fn()} onToast={vi.fn()} />);
      pickFile();
      await screen.findByRole("heading", { name: "Solaris" });

      const DUNE = { ...SOLARIS, title: "Diuna", previewUrl: "data:image/jpeg;base64,DUNE" };
      mockScan.mockResolvedValueOnce(DUNE);
      pickFile();
      await screen.findByRole("heading", { name: "Diuna" });

      await act(async () => first.resolve({ ...SOLARIS, cover_url: CATALOG_COVER }));
      expect(screen.getByRole("heading", { name: "Diuna" })).toBeInTheDocument();
    });
  });
});
