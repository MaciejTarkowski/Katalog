import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Required by the Android TWA (APK) so it opens full-screen instead of showing Chrome's address bar.
describe("Digital Asset Links (public/.well-known/assetlinks.json)", () => {
  it("declares the TWA package with a valid SHA-256 cert fingerprint", () => {
    const raw = readFileSync(
      join(process.cwd(), "public", ".well-known", "assetlinks.json"),
      "utf-8"
    );
    const statements = JSON.parse(raw);

    expect(Array.isArray(statements)).toBe(true);
    const [statement] = statements;
    expect(statement.relation).toContain("delegate_permission/common.handle_all_urls");
    expect(statement.target.namespace).toBe("android_app");
    expect(statement.target.package_name).toBeTruthy();
    expect(statement.target.sha256_cert_fingerprints[0]).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });
});
