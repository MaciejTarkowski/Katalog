/** Rectangle as fractions (0–1) of the image: top-left corner plus size. */
export interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Crops an image data URL to `box` and returns it as a JPEG data URL. */
export function cropImage(dataUrl: string, box: CropBox, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Nie udało się załadować obrazu do kadrowania."));
    img.onload = () => {
      const sx = Math.round(box.x * img.width);
      const sy = Math.round(box.y * img.height);
      const sw = Math.max(1, Math.round(box.w * img.width));
      const sh = Math.max(1, Math.round(box.h * img.height));

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Nie udało się utworzyć kontekstu canvas 2D."));
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}
