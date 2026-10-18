import { test, expect, mockBackend, USER_ID } from "./fixtures";

test.describe("Języki interfejsu", () => {
  test("domyślnie po angielsku, wybór języka zostaje zapamiętany", async ({ page }) => {
    await mockBackend(page, undefined, { locale: null });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Your whole collection. On one screen." })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.getByRole("button", { name: "Deutsch" }).click();
    await expect(page.getByRole("button", { name: "Anmelden", exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Anmelden", exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
  });

  test("udostępniona kolekcja po angielsku dla gościa", async ({ page }) => {
    await mockBackend(page, undefined, { locale: null });
    await page.goto(`/share/${USER_ID}`);
    await expect(page.getByText("Public collection")).toBeVisible();
    await expect(page.getByRole("region", { name: "Books" })).toBeVisible();
  });
});
