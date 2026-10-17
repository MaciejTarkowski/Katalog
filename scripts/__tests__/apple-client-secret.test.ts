import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { describe, it, expect } from "vitest";
import { createAppleClientSecret } from "../apple-client-secret.mjs";

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());

describe("createAppleClientSecret", () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const now = 1_800_000_000;

  it("builds the ES256 JWT Supabase expects as the Apple secret key", () => {
    const jwt = createAppleClientSecret({ teamId: "TEAM123", keyId: "KEY123", clientId: "pl.katalog.web", privateKey: pem, now });
    const [header, payload, signature] = jwt.split(".");

    expect(decode(header)).toEqual({ alg: "ES256", kid: "KEY123", typ: "JWT" });
    expect(decode(payload)).toEqual({
      iss: "TEAM123",
      iat: now,
      exp: now + 15_777_000,
      aud: "https://appleid.apple.com",
      sub: "pl.katalog.web",
    });
    const valid = verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      { key: createPublicKey(pem), dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url")
    );
    expect(valid).toBe(true);
  });

  it("refuses a validity longer than Apple's 6-month limit", () => {
    expect(() =>
      createAppleClientSecret({ teamId: "T", keyId: "K", clientId: "c", privateKey: pem, now, days: 200 })
    ).toThrow(/183/);
  });
});
