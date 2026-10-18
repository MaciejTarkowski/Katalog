import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchItems,
  fetchPublicItems,
  fetchItemById,
  addItem,
  deleteItem,
  updateItemMetadata,
} from "../api";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockSingle = vi.fn();
const mockGetUser = vi.fn();
const mockQueryEq = vi.fn();
const mockQueryOr = vi.fn();
const mockQueryNeq = vi.fn();

let currentQueryResult: { data: unknown; error: unknown } = { data: [], error: null };

function createQueryBuilder() {
  const getPromise = () => Promise.resolve(currentQueryResult);
  const builder = {
    order: vi.fn().mockImplementation(() => builder),
    eq: mockQueryEq.mockImplementation(() => builder),
    or: mockQueryOr.mockImplementation(() => builder),
    neq: mockQueryNeq.mockImplementation(() => builder),
    limit: vi.fn().mockImplementation(() => builder),
    maybeSingle: vi.fn().mockImplementation(() => getPromise()),
    then: (
      onfulfilled?: (value: typeof currentQueryResult) => unknown,
      onrejected?: (reason: unknown) => unknown
    ) => getPromise().then(onfulfilled, onrejected),
    catch: (onrejected?: (reason: unknown) => unknown) => getPromise().catch(onrejected),
  };
  return builder;
}

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc.mockImplementation(() => createQueryBuilder()),
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => {
      if (table === "items") {
        return {
          select: mockSelect.mockImplementation(() => createQueryBuilder()),
          insert: mockInsert.mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
          delete: mockDelete.mockReturnValue({
            eq: mockEq,
          }),
          update: mockUpdate.mockReturnValue({
            eq: mockUpdateEq,
          }),
        };
      }
      return {};
    },
  }),
}));

describe("Items API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchItems returns list of items", async () => {
    const mockData = [
      { id: "1", title: "Solaris", category: "book" },
      { id: "2", title: "Kind of Blue", category: "music" },
    ];
    currentQueryResult = { data: mockData, error: null };
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });

    const result = await fetchItems();
    expect(result.data).toEqual(mockData);
    expect(result.error).toBeNull();
  });

  it("fetchItems returns only the signed-in user's items (public read RLS)", async () => {
    currentQueryResult = { data: [], error: null };
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });

    await fetchItems();
    expect(mockQueryEq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("fetchItems returns error when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await fetchItems();
    expect(result.data).toBeNull();
    expect(result.error).toBe("Użytkownik nie jest zalogowany");
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("fetchPublicItems returns list of items for specified user_id", async () => {
    const mockData = [
      { id: "1", user_id: "user-456", title: "Solaris", category: "book" },
    ];
    currentQueryResult = { data: mockData, error: null };

    const result = await fetchPublicItems("user-456");
    expect(result.data).toEqual(mockData);
    expect(result.error).toBeNull();
    // Only through the RPC, which returns rows only when the owner shares the collection.
    expect(mockRpc).toHaveBeenCalledWith("shared_items", { p_user_id: "user-456" });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("fetchPublicItems filters by category and reports errors", async () => {
    currentQueryResult = { data: [], error: null };
    await fetchPublicItems("user-456", "game");
    expect(mockQueryEq).toHaveBeenCalledWith("category", "game");

    currentQueryResult = { data: null, error: { message: "boom" } };
    expect(await fetchPublicItems("user-456")).toEqual({ data: null, error: "boom" });
  });

  it("addItem returns error when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await addItem({
      title: "Dune",
      artist_creator: "Frank Herbert",
      category: "book",
      subcategory: "sci-fi",
      cover_url: null,
      metadata: {},
    });

    expect(result.error).toBe("Użytkownik nie jest zalogowany");
    expect(result.data).toBeNull();
  });

  it("addItem rejects a duplicate title with the same category and subcategory", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    currentQueryResult = { data: [{ title: "  Dune  ", category: "book", subcategory: "Sci-Fi" }], error: null };

    const result = await addItem({
      title: "dune",
      artist_creator: "Frank Herbert",
      category: "book",
      subcategory: "sci-fi",
      cover_url: null,
      metadata: {},
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("„dune” (sci-fi) jest już w Twoim katalogu.");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("addItem allows the same title under a different subcategory (e.g. a game on another platform)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    currentQueryResult = {
      data: [{ title: "Marvel's Spider-Man", category: "game", subcategory: "PS4" }],
      error: null,
    };
    const insertedItem = {
      id: "item-2",
      user_id: "user-123",
      title: "Marvel's Spider-Man",
      category: "game",
      subcategory: "PS5",
      metadata: {},
    };
    mockSingle.mockResolvedValue({ data: insertedItem, error: null });

    const result = await addItem({
      title: "Marvel's Spider-Man",
      artist_creator: "Insomniac Games",
      category: "game",
      subcategory: "PS5",
      cover_url: null,
      metadata: {},
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual(insertedItem);
  });

  it("addItem inserts and returns item when user is authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    currentQueryResult = { data: [], error: null };
    const insertedItem = {
      id: "item-1",
      user_id: "user-123",
      title: "Dune",
      category: "book",
      metadata: {},
    };
    mockSingle.mockResolvedValue({ data: insertedItem, error: null });

    const result = await addItem({
      title: "Dune",
      artist_creator: "Frank Herbert",
      category: "book",
      subcategory: "sci-fi",
      cover_url: null,
      metadata: {},
    });

    expect(result.data).toEqual(insertedItem);
    expect(result.error).toBeNull();
  });

  it("addItem saves known formats and genres as codes, so they can be shown in any language", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    currentQueryResult = { data: [], error: null };
    mockSingle.mockResolvedValue({ data: { id: "item-3" }, error: null });

    await addItem({
      title: "Gruby Brzuch",
      artist_creator: "Grubson",
      category: "music",
      subcategory: "Winyl",
      cover_url: null,
      metadata: { genre: "Akcja", year: "2012" },
    });

    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({ subcategory: "vinyl", metadata: { genre: "action", year: "2012" } }),
    ]);
  });

  it("addItem treats the same format written in another language as a duplicate", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    currentQueryResult = { data: [{ title: "Gruby Brzuch", category: "music", subcategory: "Vinyl" }], error: null };

    const result = await addItem({
      title: "Gruby Brzuch",
      artist_creator: "Grubson",
      category: "music",
      subcategory: "winyl",
      cover_url: null,
      metadata: {},
    });

    expect(result.error).toBe("„Gruby Brzuch” (Winyl) jest już w Twoim katalogu.");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("updateItemMetadata saves the item's metadata", async () => {
    mockUpdateEq.mockResolvedValue({ error: null });
    const result = await updateItemMetadata("item-1", { year: "1961", description: "Opis." });
    expect(mockUpdate).toHaveBeenCalledWith({ metadata: { year: "1961", description: "Opis." } });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "item-1");
    expect(result).toEqual({ success: true, error: null });

    mockUpdateEq.mockResolvedValue({ error: { message: "RLS" } });
    expect(await updateItemMetadata("item-1", {})).toEqual({ success: false, error: "RLS" });
  });

  it("deleteItem deletes successfully", async () => {
    mockEq.mockResolvedValue({ error: null });

    const result = await deleteItem("item-1");
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  });

  it("fetchItemById returns a single item", async () => {
    currentQueryResult = { data: { id: "1", title: "Solaris", category: "book" }, error: null };
    const result = await fetchItemById("1");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(result).toEqual({ data: { id: "1", title: "Solaris", category: "book" }, error: null });
  });

  it("fetchItemById reads a guest's item through the shared_item RPC only", async () => {
    currentQueryResult = { data: { id: "1", title: "Solaris", category: "book" }, error: null };
    const result = await fetchItemById("1", { shared: true });
    expect(mockRpc).toHaveBeenCalledWith("shared_item", { p_id: "1" });
    expect(mockSelect).not.toHaveBeenCalled();
    expect(result.data).toEqual({ id: "1", title: "Solaris", category: "book" });
  });

  it("fetchItemById reports a missing item", async () => {
    currentQueryResult = { data: null, error: null };
    const result = await fetchItemById("missing");
    expect(result).toEqual({ data: null, error: "Nie znaleziono elementu." });
  });

  it("fetchItemById returns the database error", async () => {
    currentQueryResult = { data: null, error: { message: "invalid input syntax for type uuid" } };
    const result = await fetchItemById("bad");
    expect(result).toEqual({ data: null, error: "invalid input syntax for type uuid" });
  });
});
