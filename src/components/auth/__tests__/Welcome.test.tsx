import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Welcome } from "../Welcome";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: {} }),
}));

describe("Welcome mosaic", () => {
  beforeEach(() => sessionStorage.setItem("katalog-intro-seen", "1"));

  function mosaicSources(container: HTMLElement) {
    return Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src") ?? "");
  }

  it("mixes book, game and music covers", () => {
    const srcs = mosaicSources(render(<Welcome />).container);
    expect(srcs.some((s) => s.includes("covers.openlibrary.org"))).toBe(true);
    expect(srcs.some((s) => s.includes("steamstatic.com"))).toBe(true);
    expect(srcs.some((s) => s.includes("coverartarchive.org"))).toBe(true);
  });

  it("puts more than one kind of cover in every column", () => {
    const { container } = render(<Welcome />);
    const columns = container.querySelector('[aria-hidden="true"]')!.children;
    expect(columns.length).toBe(4);
    for (const col of Array.from(columns)) {
      const hosts = new Set(Array.from(col.querySelectorAll("img")).map((img) => new URL(img.src).host));
      expect(hosts.size).toBeGreaterThan(1);
    }
  });
});
