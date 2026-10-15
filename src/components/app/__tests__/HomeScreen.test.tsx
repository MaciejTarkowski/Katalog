import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HomeScreen } from "../HomeScreen";
import type { Item } from "@/types/database";

const items = ["A", "B", "C"].map(
  (t) =>
    ({
      id: `id-${t}`,
      user_id: "u1",
      title: `Tytuł ${t}`,
      artist_creator: null,
      category: "book",
      subcategory: null,
      cover_url: `https://example.com/${t}.jpg`,
      metadata: {},
      created_at: "2026-01-01T12:00:00Z",
    }) as Item
);

describe("HomeScreen hero carousel", () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    scrollTo.mockClear();
    Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 300 });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  });

  function renderHome() {
    return render(
      <HomeScreen items={items} userInitial="M" onOpen={vi.fn()} onProfile={vi.fn()} onAdd={vi.fn()} />
    );
  }

  function hero() {
    return screen.getAllByRole("button", { name: "Tytuł A" })[0].closest(".snap-x") as HTMLElement;
  }

  it("auto-advances when the user is idle", () => {
    renderHome();
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(scrollTo).toHaveBeenCalledWith({ left: 300, behavior: "smooth" });
  });

  it("does not auto-scroll while the user is touching the carousel", () => {
    renderHome();
    fireEvent.touchStart(hero());
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("waits a full interval after the touch ends before auto-advancing again", () => {
    renderHome();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    fireEvent.touchStart(hero());
    fireEvent.touchEnd(hero());
    act(() => {
      vi.advanceTimersByTime(1000); // 5000 ms since mount, only 1000 ms since the touch
    });
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
