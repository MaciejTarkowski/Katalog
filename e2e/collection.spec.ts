import { test, expect, mockBackend, login, SEED_ITEMS } from "./fixtures";

test.describe("1. Wyświetlanie kolekcji i kategorii/podkategorii", () => {
  test("pokazuje wszystkie elementy kolekcji po zalogowaniu", async ({ page }) => {
    await mockBackend(page);
    await login(page);

    for (const item of SEED_ITEMS) {
      await expect(page.getByTestId(`item-card-${item.id}`)).toBeVisible();
    }
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(SEED_ITEMS.length);
  });

  test("filtruje po kategorii", async ({ page }) => {
    await mockBackend(page);
    await login(page);
    const tabs = page.getByRole("tablist", { name: "Kategorie" });

    await tabs.getByRole("tab", { name: "Książki" }).click();
    await expect(tabs.getByRole("tab", { name: "Książki" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(2);
    await expect(page.getByText("Hobbit")).toBeVisible();
    await expect(page.getByText("Wiedźmin 3")).toBeHidden();

    await tabs.getByRole("tab", { name: "Gry" }).click();
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(1);

    await tabs.getByRole("tab", { name: "Inne" }).click();
    await expect(page.getByText("Pusta kolekcja")).toBeVisible();

    await tabs.getByRole("tab", { name: "Wszystkie" }).click();
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(SEED_ITEMS.length);
  });

  test("pokazuje kategorię i podkategorię na karcie elementu", async ({ page }) => {
    await mockBackend(page);
    await login(page);

    const vinyl = page.getByTestId("item-card-m1");
    await expect(vinyl.getByText("Muzyka", { exact: true })).toBeVisible();
    await expect(vinyl.getByText("Winyl", { exact: true })).toBeVisible();

    const game = page.getByTestId("item-card-g1");
    await expect(game.getByText("PS5", { exact: true })).toBeVisible();
  });
});
