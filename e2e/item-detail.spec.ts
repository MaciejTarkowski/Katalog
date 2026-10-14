import { test, expect, mockBackend, login, USER_ID } from "./fixtures";

test.describe("6. Podstrona elementu", () => {
  test("kliknięcie okładki otwiera szczegóły, a link wraca do kolekcji", async ({ page }) => {
    await mockBackend(page);
    await login(page);

    await page.getByTestId("item-card-b1").getByRole("link").click();
    await expect(page).toHaveURL(/\/item\/b1$/);
    await expect(page.getByRole("heading", { name: "Hobbit" })).toBeVisible();
    // Poprzednia trasa może zostać w DOM jako ukryta — sprawdzamy tylko widoczne elementy.
    await expect(page.getByText("J.R.R. Tolkien").filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Fantasy").filter({ visible: true })).toBeVisible();

    await page.getByRole("link", { name: /Wróć do kolekcji/ }).click();
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
