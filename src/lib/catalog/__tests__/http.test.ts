import { describe, it, expect, vi, afterEach } from "vitest";
import { catalogFetch, CATALOG_TIMEOUT_MS } from "../http";

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
});
