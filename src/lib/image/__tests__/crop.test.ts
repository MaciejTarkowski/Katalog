import { describe, it, expect, vi, beforeEach } from "vitest";
import { cropImage } from "../crop";

describe("cropImage", () => {
  const drawImage = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    drawImage.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({ drawImage }) as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,CROP");
    class MockImage {
      width = 1000;
      height = 800;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error Mocking Image
    window.Image = MockImage;
  });

  it("draws only the boxed region of the source onto a canvas of that size", async () => {
    const result = await cropImage("data:image/jpeg;base64,AAAA", { x: 0.1, y: 0.25, w: 0.5, h: 0.5 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 100, 200, 500, 400, 0, 0, 500, 400);
    expect(result).toBe("data:image/jpeg;base64,CROP");
  });

  it("rejects when the image cannot be loaded", async () => {
    class BadImage {
      onerror: (() => void) | null = null;
      set src(_v: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    // @ts-expect-error Mocking Image
    window.Image = BadImage;
    await expect(cropImage("x", { x: 0, y: 0, w: 0.5, h: 0.5 })).rejects.toThrow();
  });
});
