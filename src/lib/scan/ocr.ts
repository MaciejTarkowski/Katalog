export async function recognizeCoverText(image: File | Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng+pol");

  try {
    const { data } = await worker.recognize(image);
    return (data.text || "").trim();
  } finally {
    await worker.terminate();
  }
}
