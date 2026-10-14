import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommunitySearchDialog } from "../CommunitySearchDialog";

vi.mock("@/lib/items/api", () => ({ searchCommunityItems: vi.fn() }));

import { searchCommunityItems } from "@/lib/items/api";

const mockSearch = searchCommunityItems as unknown as ReturnType<typeof vi.fn>;

const gruby = {
  title: "Gruby Brzuch",
  artist_creator: "Grubson",
  category: "music",
  subcategory: "CD",
  cover_url: "https://coverartarchive.org/release/x/front-500",
  metadata: { year: "2012" },
};

describe("CommunitySearchDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches right away for the text read from the cover", async () => {
    mockSearch.mockResolvedValue({ data: [gruby], error: null });
    render(<CommunitySearchDialog initialQuery="Gruby" onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: /Szukaj we wpisach innych użytkowników/i })).toBeInTheDocument();
    expect(await screen.findByText("Gruby Brzuch")).toBeInTheDocument();
    expect(screen.getByText("Grubson")).toBeInTheDocument();
    expect(mockSearch).toHaveBeenCalledWith("Gruby");
  });

  it("does not search until the user types when nothing was read", () => {
    render(<CommunitySearchDialog initialQuery="" onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(mockSearch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Szukaj w kolekcjach/i })).toBeDisabled();
  });

  it("searches for typed text and returns the chosen item", async () => {
    mockSearch.mockResolvedValue({ data: [gruby], error: null });
    const onSelect = vi.fn();
    render(<CommunitySearchDialog initialQuery="" onSelect={onSelect} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Tytuł lub twórca/i), { target: { value: "Grubson" } });
    fireEvent.click(screen.getByRole("button", { name: /Szukaj w kolekcjach/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Gruby Brzuch/i }));

    expect(mockSearch).toHaveBeenCalledWith("Grubson");
    expect(onSelect).toHaveBeenCalledWith(gruby);
  });

  it("tells the user when nothing matches", async () => {
    mockSearch.mockResolvedValue({ data: [], error: null });
    render(<CommunitySearchDialog initialQuery="zzz" onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText(/Brak wpisów dla „zzz”/)).toBeInTheDocument();
  });

  it("shows the search error", async () => {
    mockSearch.mockResolvedValue({ data: null, error: "Brak połączenia" });
    render(<CommunitySearchDialog initialQuery="Solaris" onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText("Brak połączenia")).toBeInTheDocument();
  });

  it("closes with the close button and Escape", () => {
    const onClose = vi.fn();
    render(<CommunitySearchDialog initialQuery="" onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /Zamknij/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
