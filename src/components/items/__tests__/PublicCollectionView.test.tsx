import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublicCollectionView } from "../PublicCollectionView";
import { __resetLoadedImages } from "@/lib/image/useImagesReady";

const mockFetchPublicItems = vi.fn();

vi.mock("@/lib/items/api", () => ({
  fetchPublicItems: (userId: string, category?: string) =>
    mockFetchPublicItems(userId, category),
}));

const mockFetchProfile = vi.fn();

vi.mock("@/lib/profiles/api", () => ({
  fetchProfile: (userId: string) => mockFetchProfile(userId),
}));

describe("PublicCollectionView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchProfile.mockResolvedValue({ data: null, error: null });
  });

  it("fetches and renders public items without delete buttons", async () => {
    mockFetchPublicItems.mockResolvedValue({
      data: [
        {
          id: "item-1",
          user_id: "user-public",
          title: "Gra o Tron",
          artist_creator: "George R.R. Martin",
          category: "book",
          subcategory: "Fantasy",
          cover_url: null,
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });

    render(<PublicCollectionView userId="user-public" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Gra o Tron" })).toBeInTheDocument();
      expect(screen.getByText("George R.R. Martin")).toBeInTheDocument();
      expect(screen.getByText("Publiczna Kolekcja")).toBeInTheDocument();
      // Ensure NO delete button is present (read-only)
      expect(screen.queryByRole("button", { name: /Usuń/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Gra o Tron/ })).toHaveAttribute(
      "href",
      "/item/item-1?from=share"
    );
    expect(screen.getByTestId("item-card-item-1")).toBeInTheDocument();
  });

  it("uses the app's theme tokens instead of the legacy slate/blue palette", async () => {
    mockFetchPublicItems.mockResolvedValue({
      data: [
        {
          id: "item-1",
          user_id: "user-public",
          title: "Gra o Tron",
          artist_creator: null,
          category: "book",
          subcategory: null,
          cover_url: null,
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
    const { container } = render(<PublicCollectionView userId="user-public" />);
    await screen.findByRole("heading", { name: "Gra o Tron" });
    expect(container.innerHTML).not.toMatch(/slate-|blue-\d/);
    expect(screen.getByRole("tab", { name: "Wszystkie" })).toHaveAttribute("aria-selected", "true");
  });

  it("filters by category and by search text", async () => {
    const base = { user_id: "u", artist_creator: null, subcategory: null, cover_url: null, metadata: {}, created_at: "2026-01-01T00:00:00Z" };
    mockFetchPublicItems.mockResolvedValue({
      data: [
        { ...base, id: "a", title: "Hobbit", category: "book" },
        { ...base, id: "b", title: "Zelda", category: "game" },
      ],
      error: null,
    });
    render(<PublicCollectionView userId="u" />);
    await screen.findByRole("heading", { name: "Hobbit" });

    fireEvent.click(screen.getByRole("tab", { name: "Gry" }));
    expect(screen.queryByRole("heading", { name: "Hobbit" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Zelda" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Wszystkie" }));
    fireEvent.change(screen.getByLabelText("Szukaj w kolekcji"), { target: { value: "hob" } });
    expect(screen.getByRole("heading", { name: "Hobbit" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Zelda" })).not.toBeInTheDocument();
  });

  it("copies link to clipboard when clicking Udostępnij button", async () => {
    mockFetchPublicItems.mockResolvedValue({ data: [], error: null });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<PublicCollectionView userId="user-public" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Udostępnij/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Udostępnij/i }));
    });

    expect(writeTextMock).toHaveBeenCalled();
  });

  it("displays error message if fetchPublicItems fails", async () => {
    mockFetchPublicItems.mockResolvedValue({
      data: null,
      error: "Kolekcja nie została znaleziona",
    });

    render(<PublicCollectionView userId="unknown-user" />);

    await waitFor(() => {
      expect(screen.getByText("Kolekcja nie została znaleziona")).toBeInTheDocument();
    });
  });

  it("shows the name of the user who shared the collection", async () => {
    mockFetchPublicItems.mockResolvedValue({ data: [], error: null });
    mockFetchProfile.mockResolvedValue({
      data: { id: "user-public", display_name: "Maciek" },
      error: null,
    });

    render(<PublicCollectionView userId="user-public" />);

    expect(
      await screen.findByRole("heading", { name: "Kolekcja użytkownika Maciek" })
    ).toBeInTheDocument();
    expect(mockFetchProfile).toHaveBeenCalledWith("user-public");
  });

  it("falls back to a generic title when the user has no display name", async () => {
    mockFetchPublicItems.mockResolvedValue({ data: [], error: null });
    render(<PublicCollectionView userId="user-public" />);
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Kolekcja użytkownika" })).toBeInTheDocument();
  });

  it("shows one loader until the covers are loaded instead of tiles popping in", async () => {
    __resetLoadedImages();
    Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => false });
    mockFetchPublicItems.mockResolvedValue({
      data: [
        {
          id: "item-1",
          user_id: "user-public",
          title: "Wiedźmin",
          artist_creator: null,
          category: "book",
          subcategory: null,
          cover_url: "https://example.com/w.jpg",
          metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
    render(<PublicCollectionView userId="user-public" />);
    // Items are fetched (the summary shows them), but their cover is still loading.
    await waitFor(() => expect(screen.getByText(/Tryb tylko do odczytu ·/)).toBeInTheDocument());
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Wiedźmin")).not.toBeInTheDocument();

    Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });
  });

  it("hides the categories the owner does not keep, waiting for the profile first", async () => {
    const item = (id: string, category: string) => ({
      id,
      user_id: "user-public",
      title: `Tytuł ${id}`,
      artist_creator: null,
      category,
      subcategory: null,
      cover_url: null,
      metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    });
    mockFetchPublicItems.mockResolvedValue({ data: [item("b", "book"), item("g", "game")], error: null });
    let resolveProfile!: (value: unknown) => void;
    mockFetchProfile.mockReturnValue(new Promise((r) => (resolveProfile = r)));

    render(<PublicCollectionView userId="user-public" />);
    await waitFor(() => expect(mockFetchPublicItems).toHaveBeenCalled());
    expect(screen.queryByTestId("item-card-b")).not.toBeInTheDocument();

    await act(async () => resolveProfile({ data: { id: "user-public", display_name: "M", collection_types: ["game"] }, error: null }));

    expect(await screen.findByTestId("item-card-g")).toBeInTheDocument();
    expect(screen.queryByTestId("item-card-b")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Książki" })).not.toBeInTheDocument();
    expect(screen.getByText(/1 pozycj/)).toBeInTheDocument();
  });
});
