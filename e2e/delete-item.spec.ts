import { test, expect, mockBackend, login, SEED_ITEMS } from "./fixtures";

test.describe("4. Usunięcie elementu", () => {
  test("usuwa element z kolekcji i z bazy", async ({ page }) => {
    const backend = await mockBackend(page);
    await login(page);

    await expect(page.getByTestId("item-card-b1")).toBeVisible();
    await page.getByRole("button", { name: "Usuń Hobbit" }).click();

    await expect(page.getByTestId("item-card-b1")).toHaveCount(0);
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(SEED_ITEMS.length - 1);
    expect(backend.deletes).toEqual(["b1"]);
  });

  test("usunięty element nie wraca po odświeżeniu", async ({ page }) => {
    await mockBackend(page);
    await login(page);

    await page.getByRole("button", { name: "Usuń Hobbit" }).click();
    await expect(page.getByTestId("item-card-b1")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("item-card-b2")).toBeVisible();
    await expect(page.getByTestId("item-card-b1")).toHaveCount(0);
  });
});
