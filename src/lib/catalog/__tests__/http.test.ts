import { describe, it, expect, vi, afterEach } from "vitest";
import { catalogFetch, CATALOG_TIMEOUT_MS, CATALOG_USER_AGENT } from "../http";

describe("catalogFetch", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("aborts a catalog request that takes too long so one slow provider does not stall the scan", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await catalogFetch("https://example.com/api");

    expect(timeout).toHaveBeenCalledWith(CATALOG_TIMEOUT_MS);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps a signal passed by the caller", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const signal = new AbortController().signal;

    await catalogFetch("https://example.com/api", { signal });

    expect(fetchMock.mock.calls[0][1].signal).toBe(signal);
  });

  it("identifies itself with a real contact address, as MusicBrainz and Wikipedia require", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await catalogFetch("https://example.test/");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("User-Agent")).toBe(CATALOG_USER_AGENT);
    expect(CATALOG_USER_AGENT).toContain("nerdousai@gmail.com");
    expect(CATALOG_USER_AGENT).not.toContain("github.com/katalog-app");
  });
});
