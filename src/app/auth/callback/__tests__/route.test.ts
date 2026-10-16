import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

function request(search: string) {
  return new NextRequest(`http://localhost:3000/auth/callback${search}`);
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
  });

  it("wymienia kod na sesję i przekierowuje na stronę główną", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(request("?code=abc"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("przy błędzie wymiany przekierowuje na stronę główną z flagą błędu", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad" } });
    const res = await GET(request("?code=abc"));
    expect(new URL(res.headers.get("location")!).searchParams.get("auth_error")).toBe("1");
  });

  it("bez kodu nie wywołuje Supabase i przekierowuje z flagą błędu", async () => {
    const res = await GET(request(""));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(new URL(res.headers.get("location")!).searchParams.get("auth_error")).toBe("1");
  });
});
