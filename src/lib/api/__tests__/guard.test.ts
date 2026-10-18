import { describe, it, expect, vi, beforeEach } from "vitest";
import { guardRequest } from "../guard";

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mockRpc }),
}));

const req = (locale = "pl") => ({ headers: new Headers({ "x-locale": locale }) });

describe("guardRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets a signed-in user within the quota through", async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    expect(await guardRequest(req(), "recognize")).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith("consume_api_quota", { p_bucket: "recognize" });
  });

  it("answers 401 to a visitor who is not signed in", async () => {
    mockRpc.mockResolvedValue({ data: -1, error: null });
    const res = await guardRequest(req(), "catalog");
    expect(res?.status).toBe(401);
    expect((await res!.json()).error).toBe("Zaloguj się, aby skorzystać z tej funkcji.");
  });

  it("answers 429 once the quota is used up", async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });
    const res = await guardRequest(req("en"), "recognize");
    expect(res?.status).toBe(429);
    expect((await res!.json()).error).toBe("Too many requests. Please try again in a while.");
  });

  it("refuses when the quota cannot be checked, instead of letting everyone through", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    expect((await guardRequest(req(), "recognize"))?.status).toBe(503);

    mockRpc.mockRejectedValue(new Error("network"));
    expect((await guardRequest(req(), "recognize"))?.status).toBe(503);
  });
});
