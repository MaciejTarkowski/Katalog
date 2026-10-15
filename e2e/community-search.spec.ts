import { test, expect, mockBackend, login, openTab, pickCoverPhoto, makeItem, SEED_ITEMS, type Backend } from "./fixtures";

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
    // Okładka z zewnętrznego serwera nie jest potrzebna.
    await page.route("https://coverartarchive.org/**", (route) => route.abort());
    await login(page);
  });

  test("arkusz wyszukiwania pozwala wybrać istniejący wpis i zapisać go w swojej kolekcji", async ({ page }) => {
    await openTab(page, "Dodaj");
    await pickCoverPhoto(page);

    const sheet = page.getByRole("dialog", { name: "Wyszukaj tytuł" });
    await expect(sheet).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Nie znaleziono metadanych." })).toBeVisible();

    await sheet.getByRole("searchbox", { name: "Tytuł lub twórca" }).fill("gruby");
    await sheet.getByRole("button", { name: /Gruby Brzuch/ }).click();
    await expect(sheet.getByText("Wybrano: Gruby Brzuch")).toBeVisible();
    await sheet.getByRole("button", { name: "Dodaj wybraną pozycję" }).click();

    await expect(sheet).toBeHidden();
    await expect(page.getByRole("heading", { name: "Gruby Brzuch" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Grubson", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Dodaj do kolekcji" }).click();
    await expect.poll(() => backend.inserts.length).toBe(1);
    expect(backend.inserts[0]).toMatchObject({
      title: "Gruby Brzuch",
      artist_creator: "Grubson",
      category: "music",
      cover_url: OTHER_ITEM.cover_url,
    });

    await openTab(page, "Home");
    await expect(page.getByTestId("item-card-new-1")).toBeVisible();
  });

  test("„lub wpisz tytuł” otwiera wyszukiwanie bez skanowania", async ({ page }) => {
    await openTab(page, "Dodaj");
    await page.getByRole("button", { name: /lub wpisz tytuł/ }).click();

    const sheet = page.getByRole("dialog", { name: "Wyszukaj tytuł" });
    await sheet.getByRole("searchbox", { name: "Tytuł lub twórca" }).fill("grubson");
    await expect(sheet.getByRole("button", { name: /Gruby Brzuch/ })).toBeVisible();
    await expect(sheet.getByText("1 wpis w katalogach i kolekcjach")).toBeVisible();
  });
});
