import { test, expect, mockBackend, login, SCANNED, COVER_PNG } from "./fixtures";

test.describe("3. Sugestia kategorii", () => {
  test("po rozpoznaniu formularz sugeruje kategorię i podkategorię", async ({ page }) => {
    await mockBackend(page);
    await login(page);

    await page.getByRole("button", { name: "+ Dodaj przedmiot" }).click();
    // Domyślnie „Książka” — sugestia ma to nadpisać.
    await expect(page.getByLabel("Kategoria", { exact: true })).toHaveValue("book");

    await page.getByTestId("cover-scan-file-input").setInputFiles({
      name: "okladka.png",
      mimeType: "image/png",
      buffer: COVER_PNG,
    });

    await expect(page.getByLabel("Kategoria", { exact: true })).toHaveValue(SCANNED.category);
    await expect(page.getByLabel("Podkategoria / Format")).toHaveValue(SCANNED.subcategory);
  });

  test("zasugerowaną kategorię można zmienić przed zapisem", async ({ page }) => {
    const backend = await mockBackend(page);
    await login(page);

    await page.getByRole("button", { name: "+ Dodaj przedmiot" }).click();
    await page.getByTestId("cover-scan-file-input").setInputFiles({
      name: "okladka.png",
      mimeType: "image/png",
      buffer: COVER_PNG,
    });
    await expect(page.getByLabel("Kategoria", { exact: true })).toHaveValue(SCANNED.category);

    await page.getByLabel("Kategoria", { exact: true }).selectOption("other");
    await page.getByRole("button", { name: "Dodaj do kolekcji" }).click();

    await expect(page.getByTestId("item-card-new-1")).toBeVisible();
    expect(backend.inserts[0]).toMatchObject({ category: "other" });
  });
});
