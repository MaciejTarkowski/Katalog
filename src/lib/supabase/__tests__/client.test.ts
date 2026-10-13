import { describe, it, expect, vi } from "vitest";
import { createClient } from "../client";

describe("Supabase Browser Client", () => {
  it("initializes client successfully", () => {
    const client = createClient();
    expect(client).toBeDefined();
    expect(typeof client.auth.signInWithPassword).toBe("function");
    expect(typeof client.from).toBe("function");
  });
});
