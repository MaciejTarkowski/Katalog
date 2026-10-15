import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ItemDetailView } from "../ItemDetailView";

vi.mock("@/lib/items/api", () => ({
  fetchItemById: vi.fn(),
}));

import { fetchItemById } from "@/lib/items/api";

const mockedFetch = fetchItemById as unknown as ReturnType<typeof vi.fn>;

describe("ItemDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows item details with labelled metadata", async () => {
    mockedFetch.mockResolvedValue({
      data: {
        id: "item-1",
        user_id: "user-1",
        title: "Hobbit",
        artist_creator: "J.R.R. Tolkien",
        category: "book",
        subcategory: "Fantasy",
        cover_url: "https://example.com/hobbit.jpg",
        metadata: {
          year: "1937",
          publisher: "Iskry",
          isbn: "9788324405476",
          source: "openlibrary",
          musicbrainz_id: "abc",
          nested: { a: 1 },
        },
        created_at: "2026-01-01T12:00:00Z",
      },
      error: null,
    });

    render(<ItemDetailView itemId="item-1" />);

    expect(await screen.findByRole("heading", { name: "Hobbit" })).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledWith("item-1");
    expect(screen.getByText("J.R.R. Tolkien")).toBeInTheDocument();
    expect(screen.getByText("Książka")).toBeInTheDocument();
    expect(screen.getByText("Fantasy")).toBeInTheDocument();
    expect(screen.getByAltText("Hobbit")).toHaveAttribute("src", "https://example.com/hobbit.jpg");
    expect(screen.getByText("Rok")).toBeInTheDocument();
    expect(screen.getByText("1937")).toBeInTheDocument();
    expect(screen.getByText("Wydawca")).toBeInTheDocument();
    expect(screen.getByText("ISBN")).toBeInTheDocument();
    expect(screen.queryByText("Źródło")).not.toBeInTheDocument();
    expect(screen.queryByText("Open Library")).not.toBeInTheDocument();
    expect(screen.queryByText("musicbrainz_id")).not.toBeInTheDocument();
    expect(screen.queryByText("nested")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Wróć/ })).toHaveAttribute("href", "/");
  });

  it("links back to the shared collection when opened from a share link", async () => {
    mockedFetch.mockResolvedValue({
      data: {
        id: "item-1",
        user_id: "user-9",
        title: "Hobbit",
        artist_creator: null,
        category: "book",
        subcategory: null,
        cover_url: null,
        metadata: {},
        created_at: "2026-01-01T12:00:00Z",
      },
      error: null,
    });
    render(<ItemDetailView itemId="item-1" fromShare />);
    expect(await screen.findByRole("link", { name: /Wróć/ })).toHaveAttribute(
      "href",
      "/share/user-9"
    );
  });

  it("shows an error when the item cannot be loaded", async () => {
    mockedFetch.mockResolvedValue({ data: null, error: "Nie znaleziono elementu." });
    render(<ItemDetailView itemId="missing" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie znaleziono elementu.");
  });
});
