import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dashboard } from "../Dashboard";

const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      }),
    },
  }),
}));

vi.mock("@/lib/items/api", () => ({
  fetchItems: vi.fn().mockResolvedValue({
    data: [
      {
        id: "item-1",
        title: "Wiedźmin",
        category: "book",
        artist_creator: "Andrzej Sapkowski",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    error: null,
  }),
  addItem: vi.fn().mockResolvedValue({
    data: {
      id: "item-2",
      title: "Cyberpunk 2077",
      category: "game",
      artist_creator: "CD Projekt RED",
      created_at: "2026-01-02T00:00:00Z",
    },
    error: null,
  }),
  deleteItem: vi.fn().mockResolvedValue({ success: true, error: null }),
}));

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders auth form when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Zaloguj się do Katalogu" })).toBeInTheDocument();
    });
  });

  it("renders user view and items when user is authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "kolekcjoner@example.com" } },
      error: null,
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("kolekcjoner@example.com")).toBeInTheDocument();
      expect(screen.getByText("+ Dodaj przedmiot")).toBeInTheDocument();
      expect(screen.getByText("Wiedźmin")).toBeInTheDocument();
    });
  });

  it("toggles add item form when clicking '+ Dodaj przedmiot'", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "kolekcjoner@example.com" } },
      error: null,
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("+ Dodaj przedmiot")).toBeInTheDocument();
      expect(screen.getByText("Wiedźmin")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("+ Dodaj przedmiot"));
    });

    expect(screen.getByRole("heading", { name: "Dodaj nowy element" })).toBeInTheDocument();
    expect(screen.getByText("Zamknij")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("Zamknij"));
    });
    expect(screen.getByText("+ Dodaj przedmiot")).toBeInTheDocument();
  });

  it("copies public collection share link to clipboard", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-test-uuid", email: "kolekcjoner@example.com" } },
      error: null,
    });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("🔗 Udostępnij moją kolekcję")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("🔗 Udostępnij moją kolekcję"));
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining("/share/user-test-uuid")
    );
    expect(screen.getByText("✓ Skopiowano link do schowka!")).toBeInTheDocument();
  });
});
