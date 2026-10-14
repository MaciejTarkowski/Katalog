const BARCODE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
] as const;

function normalizeCode(value: string): string {
  return value.replace(/\s/g, "").trim();
}

interface DetectedBarcodeLike {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect: (source: ImageBitmap) => Promise<DetectedBarcodeLike[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: readonly string[] }): BarcodeDetectorLike;
}

function getBarcodeDetector(): BarcodeDetectorConstructor | null {
  if (typeof window === "undefined") return null;
  const Detector = (
    window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
  ).BarcodeDetector;
  return Detector ?? null;
}

async function detectWithNativeApi(file: File): Promise<string | null> {
  const Detector = getBarcodeDetector();
  if (!Detector) return null;

  try {
    const detector = new Detector({ formats: BARCODE_FORMATS });
    const bitmap = await createImageBitmap(file);
    try {
      const codes = await detector.detect(bitmap);
      const value = codes[0]?.rawValue;
      return value ? normalizeCode(value) : null;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

function ensureHiddenScannerHost(id: string): HTMLElement {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.setAttribute("aria-hidden", "true");
    el.style.position = "absolute";
    el.style.width = "1px";
    el.style.height = "1px";
    el.style.overflow = "hidden";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
  }
  return el;
}

async function detectWithHtml5Qrcode(file: File): Promise<string | null> {
  const { Html5Qrcode } = await import("html5-qrcode");
  const hostId = "katalog-barcode-file-scanner";
  ensureHiddenScannerHost(hostId);
  const scanner = new Html5Qrcode(hostId, { verbose: false });

  try {
    const text = await scanner.scanFile(file, true);
    return text ? normalizeCode(text) : null;
  } catch {
    return null;
  } finally {
    try {
      await scanner.clear();
    } catch {
      /* scanner may already be idle */
    }
  }
}

export async function detectBarcodeFromFile(file: File): Promise<string | null> {
  const native = await detectWithNativeApi(file);
  if (native) return native;
  return detectWithHtml5Qrcode(file);
}

export async function startLiveBarcodeScan(
  elementId: string,
  onDetected: (code: string) => void
): Promise<() => Promise<void>> {
  const { Html5Qrcode } = await import("html5-qrcode");
  const scanner = new Html5Qrcode(elementId, { verbose: false });
  let handled = false;

  await scanner.start(
    { facingMode: "environment" },
    { fps: 8, qrbox: { width: 280, height: 140 } },
    (decodedText) => {
      if (handled) return;
      handled = true;
      onDetected(normalizeCode(decodedText));
    },
    () => undefined
  );

  return async () => {
    handled = true;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      /* already stopped */
    }
  };
}
