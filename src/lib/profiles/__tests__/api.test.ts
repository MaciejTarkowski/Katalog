import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpsert = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect, upsert: mockUpsert }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { fetchProfile, updateDisplayName } from "../api";

describe("Profiles API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchProfile returns the profile of a user", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "u1", display_name: "Maciek" }, error: null });
    const result = await fetchProfile("u1");
    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockSelect).toHaveBeenCalledWith("id, display_name");
    expect(mockEq).toHaveBeenCalledWith("id", "u1");
    expect(result).toEqual({ data: { id: "u1", display_name: "Maciek" }, error: null });
  });

  it("fetchProfile returns null data when the user has no profile", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchProfile("u1")).toEqual({ data: null, error: null });
  });

  it("fetchProfile returns the database error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await fetchProfile("u1")).toEqual({ data: null, error: "boom" });
  });

  it("updateDisplayName upserts the trimmed name for the current user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockUpsert.mockResolvedValue({ error: null });
    const result = await updateDisplayName("  Maciek  ");
    expect(mockUpsert).toHaveBeenCalledWith({ id: "u1", display_name: "Maciek" });
    expect(result).toEqual({ success: true, error: null });
  });

  it("updateDisplayName rejects an empty or too long name", async () => {
    expect(await updateDisplayName("   ")).toEqual({
      success: false,
      error: "Nazwa musi mieć od 1 do 50 znaków.",
    });
    expect(await updateDisplayName("x".repeat(51))).toEqual({
      success: false,
      error: "Nazwa musi mieć od 1 do 50 znaków.",
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("updateDisplayName requires a logged-in user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await updateDisplayName("Maciek")).toEqual({
      success: false,
      error: "Użytkownik nie jest zalogowany",
    });
  });
});
