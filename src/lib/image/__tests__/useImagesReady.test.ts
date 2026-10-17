import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useImagesReady, __resetLoadedImages } from "../useImagesReady";

/** Images that stay pending until the test fires load/error on them. */
let created: HTMLImageElement[] = [];
const OriginalImage = window.Image;

beforeEach(() => {
  vi.useFakeTimers();
  __resetLoadedImages();
  created = [];
  Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => false });
  window.Image = class extends OriginalImage {
    constructor() {
      super();
      created.push(this);
    }
  } as typeof Image;
});

afterEach(() => {
  vi.useRealTimers();
  window.Image = OriginalImage;
  Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });
});

const fire = (img: HTMLImageElement, type: "load" | "error") => act(() => void img.dispatchEvent(new Event(type)));

describe("useImagesReady", () => {
  it("is ready right away when there is nothing to load", () => {
    const { result } = renderHook(() => useImagesReady([]));
    expect(result.current).toBe(true);
  });

  it("waits until every image has loaded or failed", () => {
    const { result } = renderHook(() => useImagesReady(["https://x/a.jpg", "https://x/b.jpg"]));
    expect(result.current).toBe(false);
    fire(created[0], "load");
    expect(result.current).toBe(false);
    fire(created[1], "error");
    expect(result.current).toBe(true);
  });

  it("gives up waiting after the timeout so one slow cover does not block the screen", () => {
    const { result } = renderHook(() => useImagesReady(["https://x/slow.jpg"], 3000));
    act(() => void vi.advanceTimersByTime(2999));
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("does not wait again for images already loaded in this session", () => {
    const first = renderHook(() => useImagesReady(["https://x/a.jpg"]));
    fire(created[0], "load");
    first.unmount();
    const { result } = renderHook(() => useImagesReady(["https://x/a.jpg"]));
    expect(result.current).toBe(true);
  });

  it("stays ready when the list changes later (e.g. a newly added item)", () => {
    const { result, rerender } = renderHook(({ urls }) => useImagesReady(urls), {
      initialProps: { urls: ["https://x/a.jpg"] },
    });
    fire(created[0], "load");
    rerender({ urls: ["https://x/a.jpg", "https://x/new.jpg"] });
    expect(result.current).toBe(true);
  });
});
