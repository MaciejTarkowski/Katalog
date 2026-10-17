import "@testing-library/jest-dom/vitest";

// jsdom never loads images, so `complete` would stay false and screens that wait for their
// covers (useImagesReady) would show a loader forever. Tests that need pending images override this.
Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });
