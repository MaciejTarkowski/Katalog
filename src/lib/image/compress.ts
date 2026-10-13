export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface CompressedImageResult {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  dataUrl: string;
}

export async function compressImage(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<CompressedImageResult> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku obrazu."));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error("Nie udało się załadować obrazu do przetworzenia."));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Nie udało się utworzyć kontekstu canvas 2D."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const [header, base64] = dataUrl.split(",");
        const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";

        resolve({
          base64: base64 || "",
          mimeType,
          width,
          height,
          dataUrl,
        });
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
