import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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

const mockDeleteItem = vi.fn();

vi.mock("@/lib/items/api", () => ({
  fetchItems: vi.fn().mockResolvedValue({
    data: [
      {
        id: "item-1",
        title: "Wiedźmin",
        category: "book",
        artist_creator: "Andrzej Sapkowski",
        subcategory: null,
        cover_url: null,
        metadata: { year: 1993 },
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "item-2",
        title: "Abbey Road",
        category: "music",
        artist_creator: "The Beatles",
        subcategory: "Winyl",
        cover_url: null,
        metadata: {},
        created_at: "2026-01-02T00:00:00Z",
      },
    ],
    error: null,
  }),
  addItem: vi.fn(),
  deleteItem: (id: string) => mockDeleteItem(id),
  searchCommunityItems: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

const mockEnsureProfile = vi.fn();
const mockUpdateDisplayName = vi.fn();

vi.mock("@/lib/profiles/api", async (importOriginal) => ({
  DISPLAY_NAME_MAX_LENGTH: 50,
  nameFromMetadata: (await importOriginal<typeof import("@/lib/profiles/api")>()).nameFromMetadata,
  ensureProfile: (userId: string, fallbackName: string) => mockEnsureProfile(userId, fallbackName),
  updateDisplayName: (name: string) => mockUpdateDisplayName(name),
}));

const USER = { id: "user-test-uuid", email: "kolekcjoner@example.com" };
const tab = (name: string) => within(screen.getByRole("navigation", { name: "Nawigacja" })).getByRole("button", { name });

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureProfile.mockResolvedValue({ data: null, error: null });
    mockDeleteItem.mockResolvedValue({ success: true, error: null });
  });

  it("shows the welcome screen and opens the login sheet when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    render(<Dashboard />);

    expect(await screen.findByText("Cała Twoja kolekcja. Na jednym ekranie.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Zaloguj się do Katalogu" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));
    expect(screen.getByRole("heading", { name: "Zaloguj się do Katalogu" })).toBeInTheDocument();
  });

  it("opens the sign-up sheet from the welcome screen", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    render(<Dashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Zarejestruj się" }));
    expect(screen.getByRole("heading", { name: "Utwórz konto w Katalogu" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nazwa wyświetlana")).toBeInTheDocument();
  });

  it("shows the collection in category rows on the home screen", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    render(<Dashboard />);

    const books = await screen.findByRole("region", { name: "Książki" });
    expect(within(books).getByRole("heading", { name: "Wiedźmin" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Muzyka" })).getByRole("heading", { name: "Abbey Road" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Otwórz profil" })).toHaveTextContent("K");
  });

  it("shows every category row on home without filter chips", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    render(<Dashboard />);
    await screen.findByRole("region", { name: "Książki" });

    expect(screen.getByRole("region", { name: "Muzyka" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "Kategorie" })).not.toBeInTheDocument();
  });

  it("searches the collection ignoring diacritics", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    render(<Dashboard />);
    await screen.findByRole("region", { name: "Książki" });

    fireEvent.click(tab("Szukaj"));
    fireEvent.change(screen.getByRole("searchbox", { name: "Szukaj w kolekcji" }), { target: { value: "wiedzmin" } });

    const grid = screen.getByTestId("item-grid");
    expect(within(grid).getByText("Wiedźmin")).toBeInTheDocument();
    expect(screen.queryByText("Abbey Road")).not.toBeInTheDocument();
    expect(screen.getByText("wynik")).toBeInTheDocument();
  });

  it("opens the scanner from the add tab", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    render(<Dashboard />);
    await screen.findByRole("region", { name: "Książki" });

    fireEvent.click(tab("Dodaj"));
    expect(screen.getByText("Dotknij, aby zeskanować okładkę")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zeskanuj okładkę" })).toBeInTheDocument();
  });

  it("reveals and copies the public collection share link", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    render(<Dashboard />);
    await screen.findByRole("region", { name: "Książki" });
    fireEvent.click(tab("Udostępnij"));

    const main = screen.getByText("Każdy z linkiem zobaczy Twoją kolekcję — bez zakładania konta.").parentElement!;
    fireEvent.click(within(main).getByRole("button", { name: "Udostępnij" }));
    expect(screen.getByTestId("share-url")).toHaveTextContent("/share/user-test-uuid");

    fireEvent.click(screen.getByRole("button", { name: "Kopiuj link" }));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("/share/user-test-uuid"));
      expect(screen.getByText("Skopiowano link do schowka!")).toBeInTheDocument();
    });
  });

  it("shows and saves the display name on the profile", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    mockEnsureProfile.mockResolvedValue({ data: { id: USER.id, display_name: "Maciek" }, error: null });
    mockUpdateDisplayName.mockResolvedValue({ success: true, error: null });

    render(<Dashboard />);
    await screen.findByRole("region", { name: "Książki" });
    fireEvent.click(tab("Profil"));

    expect(await screen.findByText("Maciek")).toBeInTheDocument();
    expect(mockEnsureProfile).toHaveBeenCalledWith(USER.id, "");

    fireEvent.click(screen.getByRole("button", { name: "Edytuj nazwę" }));
    fireEvent.change(screen.getByLabelText("Nazwa wyświetlana"), { target: { value: "Maciej T." } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz nazwę" }));

    await waitFor(() => {
      expect(mockUpdateDisplayName).toHaveBeenCalledWith("Maciej T.");
      expect(screen.getByText("Zapisano")).toBeInTheDocument();
      expect(screen.getByText("Maciej T.")).toBeInTheDocument();
    });
  });

  it("fills a missing display name from the Google account", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { ...USER, user_metadata: { full_name: "Jan Kowalski" } } },
      error: null,
    });
    mockEnsureProfile.mockResolvedValue({ data: { id: USER.id, display_name: "Jan Kowalski" }, error: null });
    render(<Dashboard />);

    await waitFor(() => expect(mockEnsureProfile).toHaveBeenCalledWith(USER.id, "Jan Kowalski"));
    expect(await screen.findByRole("button", { name: "Otwórz profil" })).toHaveTextContent("J");
  });

  it("shows an error when saving the display name fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    mockUpdateDisplayName.mockResolvedValue({ success: false, error: "Nazwa musi mieć od 1 do 50 znaków." });

    render(<Dashboard />);
    await screen.findByRole("region", { name: "Książki" });
    fireEvent.click(tab("Profil"));
    fireEvent.click(screen.getByRole("button", { name: "Edytuj nazwę" }));
    fireEvent.click(screen.getByRole("button", { name: "Zapisz nazwę" }));

    expect(await screen.findByText("Nazwa musi mieć od 1 do 50 znaków.")).toBeInTheDocument();
  });

  it("filters the profile grid by category stats", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    render(<Dashboard />);
    await screen.findByRole("region", { name: "Książki" });
    fireEvent.click(tab("Profil"));

    expect(screen.getByText("Cała kolekcja · 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Muzyka/ }));
    expect(screen.getByText("Muzyka · 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abbey Road" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wiedźmin" })).not.toBeInTheDocument();
  });

  it("opens item details and deletes the item", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    render(<Dashboard />);
    await screen.findByRole("region", { name: "Książki" });

    fireEvent.click(screen.getByRole("button", { name: "Wiedźmin" }));
    expect(screen.getByRole("heading", { name: "Wiedźmin", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("1993")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Usuń Wiedźmin" }));
    await waitFor(() => {
      expect(mockDeleteItem).toHaveBeenCalledWith("item-1");
      expect(screen.getByText("Usunięto „Wiedźmin”")).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Wiedźmin" })).not.toBeInTheDocument();
  });

  it("signs out from the profile menu", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    mockSignOut.mockResolvedValue({ error: null });
    render(<Dashboard />);
    await screen.findByRole("region", { name: "Książki" });
    fireEvent.click(tab("Profil"));

    fireEvent.click(screen.getByRole("button", { name: "Więcej opcji" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Wyloguj" }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(await screen.findByText("Cała Twoja kolekcja. Na jednym ekranie.")).toBeInTheDocument();
  });
});
