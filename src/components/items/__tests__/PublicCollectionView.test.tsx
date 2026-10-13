import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublicCollectionView } from "../PublicCollectionView";

const mockFetchPublicItems = vi.fn();

vi.mock("@/lib/items/api", () => ({
  fetchPublicItems: (userId: string, category?: string) =>
    mockFetchPublicItems(userId, category),
}));

describe("PublicCollectionView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(screen.getByText("Gra o Tron")).toBeInTheDocument();
      expect(screen.getByText("George R.R. Martin")).toBeInTheDocument();
      expect(screen.getByText("Publiczna Kolekcja")).toBeInTheDocument();
      // Ensure NO delete button is present (read-only)
      expect(screen.queryByRole("button", { name: /Usuń/i })).not.toBeInTheDocument();
    });
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
});
