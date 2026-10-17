/** Resolves once the image is downloaded (or failed, or `timeoutMs` passed) — never rejects. */
export function preloadImage(url: string, timeoutMs = 6000): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve();
    }
    img.onload = img.onerror = done;
    img.src = url;
    if (img.complete) done();
  });
}
