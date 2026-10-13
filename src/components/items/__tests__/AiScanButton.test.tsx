import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiScanButton } from "../AiScanButton";

vi.mock("@/lib/image/compress", () => ({
  compressImage: vi.fn().mockResolvedValue({
    base64: "mockCompressedBase64",
    mimeType: "image/jpeg",
    dataUrl: "data:image/jpeg;base64,mockCompressedBase64",
    width: 800,
    height: 600,
  }),
}));

describe("AiScanButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders trigger button", () => {
    render(<AiScanButton onScanComplete={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Zeskanuj okładkę aparatem \(Gemini AI\)/i })
    ).toBeInTheDocument();
  });

  it("processes selected image and calls onScanComplete", async () => {
    const onScanComplete = vi.fn();
    const mockAiData = {
      title: "Wiedźmin: Ostatnie Życzenie",
      artist_creator: "Andrzej Sapkowski",
      category: "book",
      subcategory: "Fantasy",
      metadata: { year: "1993" },
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockAiData }),
    });

    render(<AiScanButton onScanComplete={onScanComplete} />);

    const input = screen.getByTestId("ai-scan-file-input");
    const file = new File(["dummy"], "cover.jpg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/ai/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: "mockCompressedBase64",
          mimeType: "image/jpeg",
        }),
      });
      expect(onScanComplete).toHaveBeenCalledWith({
        ...mockAiData,
        previewUrl: "data:image/jpeg;base64,mockCompressedBase64",
      });
    });
  });

  it("triggers onError when scan request fails", async () => {
    const onError = vi.fn();

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "Błąd analizy obrazu" }),
    });

    render(<AiScanButton onScanComplete={vi.fn()} onError={onError} />);

    const input = screen.getByTestId("ai-scan-file-input");
    const file = new File(["dummy"], "cover.jpg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("Błąd analizy obrazu");
    });
  });
});
