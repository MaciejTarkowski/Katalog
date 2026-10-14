import { describe, it, expect, vi, beforeEach } from "vitest";

const scanFile = vi.fn();
const clear = vi.fn();
const start = vi.fn();
const stop = vi.fn();

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    isScanning = true;
    scanFile = scanFile;
    clear = clear;
    start = start;
    stop = stop;
    constructor() {}
  },
}));

import { detectBarcodeFromFile, startLiveBarcodeScan } from "../barcode";

describe("barcode helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("returns a code from html5-qrcode file scan", async () => {
    scanFile.mockResolvedValue("978 0261 102217");
    clear.mockResolvedValue(undefined);

    const file = new File(["img"], "cover.jpg", { type: "image/jpeg" });
    await expect(detectBarcodeFromFile(file)).resolves.toBe("9780261102217");
    expect(scanFile).toHaveBeenCalled();
  });

  it("returns null when no barcode is present", async () => {
    scanFile.mockRejectedValue(new Error("NotFound"));
    const file = new File(["img"], "cover.jpg", { type: "image/jpeg" });
    await expect(detectBarcodeFromFile(file)).resolves.toBeNull();
  });

  it("starts a live scan and reports the first code once", async () => {
    start.mockImplementation(async (_cam, _cfg, onSuccess: (text: string) => void) => {
      onSuccess("5901234123457");
      onSuccess("5901234123457");
    });

    const onDetected = vi.fn();
    const stopScan = await startLiveBarcodeScan("reader", onDetected);
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith("5901234123457");

    await stopScan();
    expect(stop).toHaveBeenCalled();
  });
});
