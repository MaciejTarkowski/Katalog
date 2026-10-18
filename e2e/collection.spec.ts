import { test, expect, mockBackend, login, openTab, SEED_ITEMS, makeItem } from "./fixtures";

test.describe("1. Wyświetlanie kolekcji i kategorii/podkategorii", () => {
  test("pokazuje wszystkie elementy kolekcji po zalogowaniu", async ({ page }) => {
    await mockBackend(page);
    await login(page);

    for (const item of SEED_ITEMS) {
      await expect(page.getByTestId(`item-card-${item.id}`)).toBeVisible();
    }
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(SEED_ITEMS.length);
  });

  test("nie pokazuje elementów innych użytkowników (RLS pozwala je czytać)", async ({ page }) => {
    await mockBackend(page, [
      ...SEED_ITEMS,
      makeItem({ id: "x1", title: "Cudzy element", user_id: "someone-else" }),
    ]);
    await login(page);

    await expect(page.getByTestId("item-card-b1")).toBeVisible();
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(SEED_ITEMS.length);
    await expect(page.getByText("Cudzy element")).toHaveCount(0);
  });

  test("grupuje kolekcję w rzędy kategorii, bez chipów filtrujących", async ({ page }) => {
    await mockBackend(page);
    await login(page);

    await expect(page.getByRole("region", { name: "Książki" }).getByTestId(/^item-card-/)).toHaveCount(2);
    await expect(page.getByRole("region", { name: "Muzyka" }).getByTestId("item-card-m1")).toBeVisible();

    await expect(page.getByRole("region", { name: "Gry" }).getByTestId("item-card-g1")).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Kategorie" })).toHaveCount(0);
  });

  test("pokazuje kategorię w wyszukiwarce i podkategorię w szczegółach", async ({ page }) => {
    await mockBackend(page);
    await login(page);

    await openTab(page, "Szukaj");
    await expect(page.getByTestId("item-card-m1").getByText("Muzyka", { exact: true })).toBeVisible();

    await page.getByTestId("item-card-g1").getByRole("button", { name: "Wiedźmin 3" }).click();
    await expect(page.getByText("Gra", { exact: true })).toBeVisible();
    await expect(page.getByText("PS5", { exact: true })).toBeVisible();
  });
});

test.describe("7. Wyszukiwanie w kolekcji", () => {
  test("filtruje po tytule i twórcy, bez polskich znaków", async ({ page }) => {
    await mockBackend(page);
    await login(page);
    await openTab(page, "Szukaj");
    const search = page.getByRole("searchbox", { name: "Szukaj w kolekcji" });

    await search.fill("wiedzmin");
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(1);
    await expect(page.getByTestId("item-card-g1")).toBeVisible();

    await search.fill("pink floyd");
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(1);
    await expect(page.getByTestId("item-card-m1")).toBeVisible();

    await search.fill("nie ma takiego");
    await expect(page.getByText("Brak wyników dla „nie ma takiego”")).toBeVisible();

    await search.fill("");
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(SEED_ITEMS.length);
  });

  test("chipy kategorii zawężają wyniki", async ({ page }) => {
    await mockBackend(page);
    await login(page);
    await openTab(page, "Szukaj");

    await page.getByRole("tablist", { name: "Kategorie" }).getByRole("tab", { name: /Książki/ }).click();
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(2);
    await expect(page.getByText("2 wyniki")).toBeVisible();
  });
});
