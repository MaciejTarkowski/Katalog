import { test, expect, mockBackend, login, makeItem, COVER_PNG, SEED_ITEMS, type Backend } from "./fixtures";

const OTHER_USER = "22222222-2222-2222-2222-222222222222";
const OTHER_ITEM = makeItem({
  id: "o1",
  user_id: OTHER_USER,
  title: "Gruby Brzuch",
  artist_creator: "Grubson",
  category: "music",
  subcategory: "CD",
  cover_url: "https://coverartarchive.org/release/418460f6/front-500",
  metadata: { year: "2012" },
});

test.describe("Brak wyników rozpoznania — wyszukiwanie we wpisach innych użytkowników", () => {
  let backend: Backend;

  test.beforeEach(async ({ page }) => {
    backend = await mockBackend(page, [...SEED_ITEMS, OTHER_ITEM]);
    // Bazy katalogowe nic nie zwracają (np. wyczerpane limity).
    await page.route("**/api/catalog/lookup", (route) =>
      route.fulfill({ status: 404, json: { error: "Nie znaleziono metadanych." } })
    );
    await login(page);
  });

  test("pop-up pozwala wybrać istniejący wpis i zapisać go w swojej kolekcji", async ({ page }) => {
    await page.getByRole("button", { name: "+ Dodaj przedmiot" }).click();
    await page.getByTestId("cover-scan-file-input").setInputFiles({
      name: "okladka.png",
      mimeType: "image/png",
      buffer: COVER_PNG,
    });

    const dialog = page.getByRole("dialog", { name: "Szukaj we wpisach innych użytkowników" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Tytuł lub twórca").fill("gruby");
    await dialog.getByRole("button", { name: "Szukaj w kolekcjach" }).click();
    await dialog.getByRole("button", { name: /Gruby Brzuch/ }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Tytuł *")).toHaveValue("Gruby Brzuch");
    await expect(page.getByLabel("Twórca / Wykonawca")).toHaveValue("Grubson");

    await page.getByRole("button", { name: "Dodaj do kolekcji" }).click();
    await expect(page.getByTestId("item-card-new-1")).toBeVisible();
    expect(backend.inserts[0]).toMatchObject({
      title: "Gruby Brzuch",
      artist_creator: "Grubson",
      category: "music",
      cover_url: OTHER_ITEM.cover_url,
    });
  });
});
