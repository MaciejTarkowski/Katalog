import { test, expect, mockBackend, login, openTab, pickCoverPhoto, SCANNED, type Backend } from "./fixtures";
import type { Page } from "@playwright/test";

async function scanCover(page: Page) {
  await openTab(page, "Dodaj");
  await expect(page.getByText("Dotknij, aby zeskanować okładkę")).toBeVisible();
  await pickCoverPhoto(page);
  // Propozycja z (zamockowanego) rozpoznania pojawia się na scenie.
  await expect(page.getByRole("heading", { name: SCANNED.title })).toBeVisible();
}

test.describe("2. Dodanie elementu ze zdjęcia (rozpoznawanie zamockowane)", () => {
  let backend: Backend;

  test.beforeEach(async ({ page }) => {
    backend = await mockBackend(page);
    await login(page);
  });

  test("rozpoznanie ze zdjęcia pokazuje propozycję z danymi z katalogu", async ({ page }) => {
    await scanCover(page);

    expect(backend.lookups).toEqual([{ ean: "0094638246824" }]);
    await expect(page.getByText(SCANNED.artist_creator, { exact: true })).toBeVisible();
    await expect(page.getByText(`Muzyka · ${SCANNED.subcategory}`)).toBeVisible();
  });

  test("potwierdzenie propozycji zapisuje element w kolekcji", async ({ page }) => {
    await scanCover(page);
    await page.getByRole("button", { name: "Dodaj do kolekcji" }).click();

    await expect(page.getByText(`Dodano „${SCANNED.title}” do kolekcji`)).toBeVisible();
    expect(backend.inserts).toHaveLength(1);
    expect(backend.inserts[0]).toMatchObject({
      title: SCANNED.title,
      artist_creator: SCANNED.artist_creator,
      category: SCANNED.category,
      subcategory: "vinyl",
    });

    await openTab(page, "Home");
    await expect(page.getByTestId("item-card-new-1")).toBeVisible();
    await expect(page.getByTestId("item-card-new-1").getByRole("heading", { name: SCANNED.title })).toBeVisible();
  });

  test("odrzucenie propozycji nie zapisuje elementu", async ({ page }) => {
    await scanCover(page);
    await page.getByRole("button", { name: "Odrzuć" }).click();

    const sheet = page.getByRole("dialog", { name: "Nie ta pozycja?" });
    await expect(sheet.getByRole("button", { name: /Zeskanuj ponownie/ })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Wpisz tytuł/ })).toBeVisible();
    await sheet.getByRole("button", { name: "Anuluj" }).click();
    await expect(sheet).toBeHidden();

    expect(backend.inserts).toHaveLength(0);
    await openTab(page, "Home");
    await expect(page.getByTestId(/^item-card-new/)).toHaveCount(0);
  });
});
