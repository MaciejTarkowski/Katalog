#!/usr/bin/env node
// Generates the "Secret Key (for OAuth)" for Sign in with Apple in Supabase: an ES256 JWT signed
// with the .p8 key from Apple. Apple accepts at most 6 months of validity, so re-run it before it expires.
// Usage (see docs/APPLE_AUTH.md):
//   node scripts/apple-client-secret.mjs --team <Team ID> --key-id <Key ID> --client-id <Services ID> --p8 AuthKey_XXXX.p8
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Apple's maximum lifetime of a client secret (about 6 months). */
const MAX_TTL_SECONDS = 15_777_000;

const base64url = (value) => Buffer.from(value).toString("base64url");

/**
 * @param {{ teamId: string, keyId: string, clientId: string, privateKey: string, now?: number, days?: number }} options
 * @returns {string}
 */
export function createAppleClientSecret({ teamId, keyId, clientId, privateKey, now = Math.floor(Date.now() / 1000), days }) {
  const ttl = days === undefined ? MAX_TTL_SECONDS : Math.round(days * 86_400);
  if (ttl > MAX_TTL_SECONDS) {
    throw new Error("Apple przyjmuje sekret ważny maksymalnie 6 miesięcy (ok. 183 dni).");
  }
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ iss: teamId, iat: now, exp: now + ttl, aud: "https://appleid.apple.com", sub: clientId })
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: createPrivateKey(privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${signature.toString("base64url")}`;
}

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const teamId = argValue(args, "--team");
  const keyId = argValue(args, "--key-id");
  const clientId = argValue(args, "--client-id");
  const p8 = argValue(args, "--p8");
  if (!teamId || !keyId || !clientId || !p8) {
    console.error(
      "Użycie: node scripts/apple-client-secret.mjs --team <Team ID> --key-id <Key ID> --client-id <Services ID> --p8 <plik .p8>"
    );
    process.exit(1);
  }
  const secret = createAppleClientSecret({ teamId, keyId, clientId, privateKey: readFileSync(p8, "utf8") });
  const expires = new Date((Math.floor(Date.now() / 1000) + MAX_TTL_SECONDS) * 1000).toISOString().slice(0, 10);
  console.log(secret);
  console.error(`\nWażny do ${expires}. Przed tą datą wygeneruj nowy i wklej go w Supabase.`);
}
