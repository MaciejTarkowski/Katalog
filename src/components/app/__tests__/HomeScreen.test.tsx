import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HomeScreen } from "../HomeScreen";
import { __resetLoadedImages } from "@/lib/image/useImagesReady";
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

  it("treats trackpad/wheel scrolling as user activity", () => {
    renderHome();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    fireEvent.wheel(hero());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("treats a manual scroll (no touch events) as user activity", () => {
    renderHome();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    hero().scrollLeft = 120;
    fireEvent.scroll(hero());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("re-aligns to the nearest slide instead of advancing when left between two slides", () => {
    renderHome();
    hero().scrollLeft = 100; // stuck between slide 0 and 1
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: "smooth" });
  });

  it("does not mistake its own smooth scroll for user activity", () => {
    renderHome();
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    hero().scrollLeft = 300;
    fireEvent.scroll(hero());
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: "smooth" });
  });

  it("batches a burst of scroll events into a single animation frame instead of updating per event", () => {
    const raf = vi.fn().mockReturnValue(1);
    vi.stubGlobal("requestAnimationFrame", raf);
    renderHome();
    const el = hero();

    el.scrollLeft = 10;
    fireEvent.scroll(el);
    el.scrollLeft = 20;
    fireEvent.scroll(el);
    el.scrollLeft = 30;
    fireEvent.scroll(el);

    expect(raf).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe("HomeScreen loading", () => {
  beforeEach(() => __resetLoadedImages());

  afterEach(() => {
    Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });
  });

  function renderHome(props: Partial<React.ComponentProps<typeof HomeScreen>> = {}) {
    return render(
      <HomeScreen items={items} userInitial="M" onOpen={vi.fn()} onProfile={vi.fn()} onAdd={vi.fn()} {...props} />
    );
  }

  it("shows one loader for the whole section while items are loading", () => {
    renderHome({ items: [], isLoading: true });
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("keeps the loader until the covers are loaded instead of showing title initials", () => {
    Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => false });
    renderHome();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("item-card-id-A")).not.toBeInTheDocument();
  });

  it("shows the collection once the covers are ready", () => {
    renderHome();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("item-card-id-A")).toBeInTheDocument();
  });
});

describe("HomeScreen category rows", () => {
  beforeEach(() => __resetLoadedImages());

  it("has no category filter pills and shows a row for every category in the collection", () => {
    const mixed = [...items, { ...items[0], id: "id-G", title: "Gra G", category: "game" } as Item];
    render(<HomeScreen items={mixed} userInitial="M" onOpen={vi.fn()} onProfile={vi.fn()} onAdd={vi.fn()} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Książki" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Gry" })).toBeInTheDocument();
  });
});
