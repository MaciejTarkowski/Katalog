import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  reporter: "line",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Systemowy Chrome — bez pobierania przeglądarki przez Playwright.
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    locale: "pl-PL",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    // Fałszywy Supabase — wszystkie żądania mockuje e2e/fixtures.ts.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
      RAWG_API_KEY: "",
      DISCOGS_TOKEN: "",
    },
  },
});
