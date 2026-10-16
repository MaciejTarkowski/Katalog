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

import { ensureProfile, fetchProfile, nameFromMetadata, updateDisplayName } from "../api";

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

  it("nameFromMetadata prefers display_name, then Google's full_name and name", () => {
    expect(nameFromMetadata({ display_name: " Maciek ", full_name: "Jan Kowalski" })).toBe("Maciek");
    expect(nameFromMetadata({ display_name: "  ", full_name: "Jan Kowalski", name: "Jan" })).toBe("Jan Kowalski");
    expect(nameFromMetadata({ name: "Jan" })).toBe("Jan");
    expect(nameFromMetadata({ full_name: "x".repeat(60) })).toBe("x".repeat(50));
    expect(nameFromMetadata({})).toBe("");
    expect(nameFromMetadata(undefined)).toBe("");
  });

  it("ensureProfile returns a named profile without writing", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "u1", display_name: "Maciek" }, error: null });
    expect(await ensureProfile("u1", "Jan Kowalski")).toEqual({
      data: { id: "u1", display_name: "Maciek" },
      error: null,
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("ensureProfile fills a missing name from the fallback (Google sign-in)", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "u1", display_name: null }, error: null });
    mockUpsert.mockResolvedValue({ error: null });
    expect(await ensureProfile("u1", "Jan Kowalski")).toEqual({
      data: { id: "u1", display_name: "Jan Kowalski" },
      error: null,
    });
    expect(mockUpsert).toHaveBeenCalledWith({ id: "u1", display_name: "Jan Kowalski" });
  });

  it("ensureProfile creates the missing profile row", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ error: null });
    expect(await ensureProfile("u1", "Jan Kowalski")).toEqual({
      data: { id: "u1", display_name: "Jan Kowalski" },
      error: null,
    });
    expect(mockUpsert).toHaveBeenCalledWith({ id: "u1", display_name: "Jan Kowalski" });
  });

  it("ensureProfile does not write without a fallback name", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "u1", display_name: null }, error: null });
    expect(await ensureProfile("u1", "")).toEqual({ data: { id: "u1", display_name: null }, error: null });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("ensureProfile returns the write error and keeps the stored profile", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "u1", display_name: null }, error: null });
    mockUpsert.mockResolvedValue({ error: { message: "boom" } });
    expect(await ensureProfile("u1", "Jan Kowalski")).toEqual({
      data: { id: "u1", display_name: null },
      error: "boom",
    });
  });
});
