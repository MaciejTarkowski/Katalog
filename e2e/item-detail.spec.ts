import { test, expect, mockBackend, login, USER_ID } from "./fixtures";

test.describe("6. Szczegóły elementu", () => {
  test("kliknięcie okładki otwiera szczegóły w aplikacji, a przycisk wraca do kolekcji", async ({ page }) => {
    await mockBackend(page);
    await login(page);

    await page.getByTestId("item-card-b1").getByRole("button", { name: "Hobbit" }).click();
    await expect(page.getByRole("heading", { name: "Hobbit", level: 1 })).toBeVisible();
    await expect(page.getByText("J.R.R. Tolkien", { exact: true })).toBeVisible();
    await expect(page.getByText("Fantasy", { exact: true })).toBeVisible();
    // „Więcej: książki” — pozostałe pozycje z tej samej kategorii.
    await expect(page.getByRole("region", { name: "Więcej" }).getByRole("button", { name: /Diuna/ })).toBeVisible();

    await page.getByRole("button", { name: "Wróć do kolekcji" }).click();
    await expect(page.getByTestId("item-card-b1")).toBeVisible();
  });

  test("podstrona /item/<id> działa samodzielnie i linkuje do kolekcji", async ({ page }) => {
    await mockBackend(page);
    await login(page);

    await page.goto("/item/b1");
    await expect(page.getByRole("heading", { name: "Hobbit", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Wróć do kolekcji" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("item-card-b1")).toBeVisible();
  });

  test("gość z linku udostępniania wraca do udostępnionej kolekcji", async ({ page }) => {
    await mockBackend(page);
    await page.goto(`/share/${USER_ID}`);

    await page.getByTestId("item-card-g1").getByRole("link").click();
    await expect(page.getByRole("heading", { name: "Wiedźmin 3" })).toBeVisible();

    await page.getByRole("link", { name: /Wróć do kolekcji/ }).click();
    await expect(page).toHaveURL(new RegExp(`/share/${USER_ID}$`));
  });

  test("nieistniejący element pokazuje komunikat", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/item/nie-ma");
    await expect(page.getByText("Nie znaleziono elementu.")).toBeVisible();
  });
});
