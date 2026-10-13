import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressImage } from "../compress";

describe("compressImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock HTMLCanvasElement methods for JSDOM
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      return {
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    });

    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,mockBase64String123"
    );
  });

  it("reads file and scales down image exceeding maxWidth and maxHeight", async () => {
    // Mock Image
    const originalImage = window.Image;
    class MockImage {
      width = 2400;
      height = 1800;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    }
    // @ts-expect-error Mocking Image
    window.Image = MockImage;

    const file = new File(["dummy content"], "test.jpg", { type: "image/jpeg" });

    const result = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });

    expect(result.width).toBe(1200);
    expect(result.height).toBe(900); // 1800 * (1200 / 2400)
    expect(result.base64).toBe("mockBase64String123");
    expect(result.mimeType).toBe("image/jpeg");

    window.Image = originalImage;
  });

  it("preserves dimensions when image is smaller than maxWidth and maxHeight", async () => {
    const originalImage = window.Image;
    class MockSmallImage {
      width = 600;
      height = 400;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    }
    // @ts-expect-error Mocking Image
    window.Image = MockSmallImage;

    const file = new File(["dummy content"], "small.jpg", { type: "image/jpeg" });

    const result = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });

    expect(result.width).toBe(600);
    expect(result.height).toBe(400);
    expect(result.base64).toBe("mockBase64String123");

    window.Image = originalImage;
  });
});
