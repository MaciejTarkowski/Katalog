import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadCoverImage, base64ToUint8Array } from "../upload";

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    storage: {
      from: (bucket: string) => {
        if (bucket === "covers") {
          return {
            upload: mockUpload,
            getPublicUrl: mockGetPublicUrl,
          };
        }
        return {};
      },
    },
  }),
}));

describe("uploadCoverImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("decodes data URL to Uint8Array and extracts mimeType", () => {
    // "SGVsbG8=" is base64 for "Hello"
    const dataUrl = "data:image/png;base64,SGVsbG8=";
    const { bytes, mimeType } = base64ToUint8Array(dataUrl);

    expect(mimeType).toBe("image/png");
    expect(bytes.length).toBe(5);
  });

  it("uploads image to Supabase Storage and returns public URL", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-abc" } }, error: null });
    mockUpload.mockResolvedValue({ data: { path: "user-abc/cover.jpg" }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/covers/user-abc/cover.jpg" },
    });

    const result = await uploadCoverImage("data:image/jpeg;base64,SGVsbG8=", "user-abc");

    expect(result.error).toBeNull();
    expect(result.publicUrl).toBe(
      "https://example.supabase.co/storage/v1/object/public/covers/user-abc/cover.jpg"
    );
    expect(mockUpload).toHaveBeenCalled();
  });

  it("handles storage upload failure", async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { message: "Storage bucket not found" },
    });

    const result = await uploadCoverImage("data:image/jpeg;base64,SGVsbG8=", "user-abc");

    expect(result.publicUrl).toBeNull();
    expect(result.error).toBe("Storage bucket not found");
  });
});
