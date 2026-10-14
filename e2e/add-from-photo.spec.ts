import { test, expect, mockBackend, login, SCANNED, COVER_PNG, type Backend } from "./fixtures";
import type { Page } from "@playwright/test";

async function scanCover(page: Page) {
  await page.getByRole("button", { name: "+ Dodaj przedmiot" }).click();
  await page.getByTestId("cover-scan-file-input").setInputFiles({
    name: "okladka.png",
    mimeType: "image/png",
    buffer: COVER_PNG,
  });
  // Propozycja z (zamockowanego) rozpoznania trafia do formularza.
  await expect(page.getByLabel("Tytuł *")).toHaveValue(SCANNED.title);
}

test.describe("2. Dodanie elementu ze zdjęcia (rozpoznawanie zamockowane)", () => {
  let backend: Backend;

  test.beforeEach(async ({ page }) => {
    backend = await mockBackend(page);
    await login(page);
  });

  test("rozpoznanie ze zdjęcia wypełnia propozycję danymi z katalogu", async ({ page }) => {
    await scanCover(page);

    expect(backend.lookups).toEqual([{ ean: "0094638246824" }]);
    await expect(page.getByLabel("Twórca / Wykonawca")).toHaveValue(SCANNED.artist_creator);
    await expect(page.getByText("Pomyślnie dociągnięto dane")).toBeVisible();
  });

  test("potwierdzenie propozycji zapisuje element w kolekcji", async ({ page }) => {
    await scanCover(page);
    await page.getByRole("button", { name: "Dodaj do kolekcji" }).click();

    await expect(page.getByTestId("item-card-new-1")).toBeVisible();
    await expect(page.getByTestId("item-card-new-1").getByText(SCANNED.title)).toBeVisible();
    expect(backend.inserts).toHaveLength(1);
    expect(backend.inserts[0]).toMatchObject({
      title: SCANNED.title,
      artist_creator: SCANNED.artist_creator,
      category: SCANNED.category,
    });
  });

  test("odrzucenie propozycji nie zapisuje elementu", async ({ page }) => {
    await scanCover(page);
    await page.getByRole("button", { name: /Odrzuć|Anuluj|Zamknij/ }).first().click();

    await expect(page.getByLabel("Tytuł *")).toHaveCount(0);
    await expect(page.getByText(SCANNED.title)).toHaveCount(0);
    expect(backend.inserts).toHaveLength(0);
  });
});
