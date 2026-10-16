import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchItems,
  fetchPublicItems,
  fetchItemById,
  addItem,
  deleteItem,
  searchCommunityItems,
} from "../api";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
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

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
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

  it("addItem rejects a duplicate title for the same user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    currentQueryResult = { data: [{ title: "  Dune  " }], error: null };

    const result = await addItem({
      title: "dune",
      artist_creator: "Frank Herbert",
      category: "book",
      subcategory: "sci-fi",
      cover_url: null,
      metadata: {},
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("„dune” jest już w Twoim katalogu.");
    expect(mockInsert).not.toHaveBeenCalled();
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

  it("searchCommunityItems matches title or creator in other users' items", async () => {
    currentQueryResult = { data: [], error: null };
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });

    await searchCommunityItems("  Gruby Brzuch ");
    expect(mockQueryOr).toHaveBeenCalledWith(
      "title.ilike.%Gruby Brzuch%,artist_creator.ilike.%Gruby Brzuch%"
    );
    expect(mockQueryNeq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("searchCommunityItems strips characters that would break the filter", async () => {
    currentQueryResult = { data: [], error: null };
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await searchCommunityItems("Gra (PS5), 100%");
    expect(mockQueryOr).toHaveBeenCalledWith("title.ilike.%Gra PS5 100%,artist_creator.ilike.%Gra PS5 100%");
    expect(mockQueryNeq).not.toHaveBeenCalled();
  });

  it("searchCommunityItems returns each title once, without owner data", async () => {
    currentQueryResult = {
      data: [
        { id: "1", user_id: "a", title: "Gruby Brzuch", artist_creator: "Grubson", category: "music", subcategory: "CD", cover_url: "https://x/1.jpg", metadata: { year: "2012" } },
        { id: "2", user_id: "b", title: "gruby brzuch", artist_creator: "Grubson", category: "music", subcategory: null, cover_url: null, metadata: {} },
        { id: "3", user_id: "c", title: "Gruby Brzuch", artist_creator: "Grubson", category: "game", subcategory: null, cover_url: null, metadata: {} },
      ],
      error: null,
    };
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await searchCommunityItems("gruby");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      { title: "Gruby Brzuch", artist_creator: "Grubson", category: "music", subcategory: "CD", cover_url: "https://x/1.jpg", metadata: { year: "2012" } },
      { title: "Gruby Brzuch", artist_creator: "Grubson", category: "game", subcategory: null, cover_url: null, metadata: {} },
    ]);
  });

  it("searchCommunityItems skips the query for less than 2 characters", async () => {
    const result = await searchCommunityItems(" a ");
    expect(result).toEqual({ data: [], error: null });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("searchCommunityItems returns the database error", async () => {
    currentQueryResult = { data: null, error: { message: "boom" } };
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await searchCommunityItems("Solaris");
    expect(result).toEqual({ data: null, error: "boom" });
  });
});
