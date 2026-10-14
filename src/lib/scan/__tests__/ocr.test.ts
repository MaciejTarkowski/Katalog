import { describe, it, expect, vi, beforeEach } from "vitest";

const recognize = vi.fn();
const terminate = vi.fn();
const createWorker = vi.fn();

vi.mock("tesseract.js", () => ({
  createWorker: (...args: unknown[]) => createWorker(...args),
}));

import { recognizeCoverText } from "../ocr";

describe("recognizeCoverText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createWorker.mockResolvedValue({ recognize, terminate });
    recognize.mockResolvedValue({ data: { text: "  The Hobbit \n Tolkien  " } });
    terminate.mockResolvedValue(undefined);
  });

  it("returns trimmed OCR text and terminates the worker", async () => {
    const file = new File(["img"], "cover.jpg", { type: "image/jpeg" });
    await expect(recognizeCoverText(file)).resolves.toBe("The Hobbit \n Tolkien");
    expect(createWorker).toHaveBeenCalledWith("eng+pol");
    expect(terminate).toHaveBeenCalled();
  });
});
