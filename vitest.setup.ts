import "@testing-library/jest-dom/vitest";

// jsdom never loads images, so `complete` would stay false and screens that wait for their
// covers (useImagesReady) would show a loader forever. Tests that need pending images override this.
Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });

// The app defaults to English; existing tests assert the Polish UI, so each test starts in Polish.
// English (the default) and switching languages are covered in src/lib/i18n/__tests__.
import { beforeEach } from "vitest";
import { setLocale } from "@/lib/i18n/locale";
beforeEach(() => setLocale("pl"));
