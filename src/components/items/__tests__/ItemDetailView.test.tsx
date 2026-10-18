import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ItemDetailView } from "../ItemDetailView";

vi.mock("@/lib/items/api", () => ({
  fetchItemById: vi.fn(),
}));

const mockDescription = vi.fn();
vi.mock("@/lib/items/description", () => ({
  fetchItemDescription: (...args: unknown[]) => mockDescription(...args),
}));

import { fetchItemById } from "@/lib/items/api";
import type { Item } from "@/types/database";
import { act } from "@testing-library/react";
import { setLocale } from "@/lib/i18n/locale";

const mockedFetch = fetchItemById as unknown as ReturnType<typeof vi.fn>;

const DIUNA: Item = {
  id: "item-9",
  user_id: "user-1",
  title: "Diuna",
  artist_creator: "Frank Herbert",
  category: "book",
  subcategory: null,
  cover_url: null,
  metadata: { year: "1965" },
  created_at: "2026-01-01T12:00:00Z",
};

describe("ItemDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDescription.mockResolvedValue(null);
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

  it("shows the format and genre in the UI language, whatever language they were saved in", () => {
    const item = {
      id: "item-7",
      user_id: "user-1",
      title: "Gruby Brzuch",
      artist_creator: "Grubson",
      category: "music",
      subcategory: "Winyl",
      cover_url: null,
      metadata: { genre: "action", year: "2012" },
      created_at: "2026-01-01T12:00:00Z",
    } as Item;
    render(<ItemDetailView item={item} />);
    expect(screen.getByText("Winyl")).toBeInTheDocument();
    expect(screen.getByText("Akcja")).toBeInTheDocument();

    act(() => setLocale("en"));
    expect(screen.getByText("Vinyl")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.queryByText("Winyl")).not.toBeInTheDocument();
  });

  it("shows an error when the item cannot be loaded", async () => {
    mockedFetch.mockResolvedValue({ data: null, error: "Nie znaleziono elementu." });
    render(<ItemDetailView itemId="missing" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie znaleziono elementu.");
  });
  describe("description", () => {
    it("shows a saved description with a link to its Wikipedia source, without looking it up again", async () => {
      const item = {
        ...DIUNA,
        metadata: {
          year: "1965",
          description: "Diuna – powieść Franka Herberta.",
          description_url: "https://pl.wikipedia.org/wiki/Diuna_(powie%C5%9B%C4%87)",
          description_lang: "pl",
        },
      };
      render(<ItemDetailView item={item} />);

      expect(screen.getByRole("heading", { name: "Opis" })).toBeInTheDocument();
      expect(screen.getByText("Diuna – powieść Franka Herberta.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Wikipedia/ })).toHaveAttribute("href", item.metadata.description_url);
      // Not repeated as a raw row under "Szczegóły".
      expect(screen.queryByText("description")).not.toBeInTheDocument();
      expect(screen.queryByText("description_url")).not.toBeInTheDocument();
      expect(mockDescription).not.toHaveBeenCalled();
    });

    it("looks up a missing description, shows it and hands the updated item back for saving", async () => {
      mockDescription.mockResolvedValue({ description: "Diuna – powieść.", url: "https://pl.wikipedia.org/wiki/Diuna" });
      const onItemChange = vi.fn();
      render(<ItemDetailView item={DIUNA} onItemChange={onItemChange} />);

      expect(await screen.findByText("Diuna – powieść.")).toBeInTheDocument();
      expect(mockDescription).toHaveBeenCalledWith(DIUNA);
      expect(onItemChange).toHaveBeenCalledWith({
        ...DIUNA,
        metadata: { year: "1965", description: "Diuna – powieść.", description_url: "https://pl.wikipedia.org/wiki/Diuna", description_lang: "pl" },
      });
    });

    it("looks a description saved in another language up again in the current one", async () => {
      mockDescription.mockResolvedValue({ description: "Diuna – powieść.", url: "https://pl.wikipedia.org/wiki/Diuna" });
      const onItemChange = vi.fn();
      const item = {
        ...DIUNA,
        metadata: { description: "Dune is a novel.", description_url: "https://en.wikipedia.org/wiki/Dune", description_lang: "en" },
      };
      render(<ItemDetailView item={item} onItemChange={onItemChange} />);

      expect(await screen.findByText("Diuna – powieść.")).toBeInTheDocument();
      expect(screen.queryByText("Dune is a novel.")).not.toBeInTheDocument();
      expect(onItemChange).toHaveBeenCalledWith({
        ...item,
        metadata: { description: "Diuna – powieść.", description_url: "https://pl.wikipedia.org/wiki/Diuna", description_lang: "pl" },
      });
    });

    it("never shows a description saved for another UI language when nothing is found in the current one", async () => {
      act(() => setLocale("en"));
      const item = {
        ...DIUNA,
        metadata: { description: "Opis po polsku.", description_url: "https://pl.wikipedia.org/wiki/Diuna", description_lang: "pl" },
      };
      render(<ItemDetailView item={item} />);

      await waitFor(() => expect(mockDescription).toHaveBeenCalled());
      expect(screen.queryByText("Opis po polsku.")).not.toBeInTheDocument();
      act(() => setLocale("pl"));
    });

    it("marks an English description shown because the UI language has no article", async () => {
      mockDescription.mockResolvedValue({ description: "Dune is a novel.", url: "https://en.wikipedia.org/wiki/Dune" });
      render(<ItemDetailView item={DIUNA} />);

      expect(await screen.findByText("Dune is a novel.")).toBeInTheDocument();
      expect(screen.getByText(/Nie znaleziono opisu po polsku/)).toBeInTheDocument();
    });

    it("does not mark a description in the UI language", async () => {
      mockDescription.mockResolvedValue({ description: "Diuna – powieść.", url: "https://pl.wikipedia.org/wiki/Diuna" });
      render(<ItemDetailView item={DIUNA} />);

      expect(await screen.findByText("Diuna – powieść.")).toBeInTheDocument();
      expect(screen.queryByText(/Nie znaleziono opisu/)).not.toBeInTheDocument();
    });

    it("does not save that there is no description, so it is looked up again on the next visit", async () => {
      mockDescription.mockResolvedValue(null);
      const onItemChange = vi.fn();
      render(<ItemDetailView item={DIUNA} onItemChange={onItemChange} />);

      await waitFor(() => expect(mockDescription).toHaveBeenCalledTimes(1));
      expect(onItemChange).not.toHaveBeenCalled();
      expect(screen.queryByRole("heading", { name: "Opis" })).not.toBeInTheDocument();
    });

    it("retries items saved earlier with an empty description and saves what it finds", async () => {
      mockDescription.mockResolvedValue({ description: "1-2-Switch is a party game.", url: "https://en.wikipedia.org/wiki/1-2-Switch" });
      const onItemChange = vi.fn();
      const item = { ...DIUNA, metadata: { description: "" } };
      render(<ItemDetailView item={item} onItemChange={onItemChange} />);

      expect(await screen.findByText("1-2-Switch is a party game.")).toBeInTheDocument();
      expect(onItemChange).toHaveBeenCalledWith({
        ...item,
        metadata: { description: "1-2-Switch is a party game.", description_url: "https://en.wikipedia.org/wiki/1-2-Switch", description_lang: "pl" },
      });
    });

    it("does not save after a failed lookup", async () => {
      mockDescription.mockResolvedValue(undefined);
      const onItemChange = vi.fn();
      render(<ItemDetailView item={{ ...DIUNA, id: "item-10" }} onItemChange={onItemChange} />);
      await waitFor(() => expect(mockDescription).toHaveBeenCalled());
      expect(onItemChange).not.toHaveBeenCalled();
    });
  });
});
