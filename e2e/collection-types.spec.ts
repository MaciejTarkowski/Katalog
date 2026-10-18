import { test, expect, mockBackend, openTab, USER_EMAIL, USER_ID } from "./fixtures";
import type { Page } from "@playwright/test";

/** Logowanie bez czekania na pasek nawigacji — przy pierwszym logowaniu najpierw jest wybór typów. */
async function signIn(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Logowanie" });
  await sheet.getByLabel("Adres e-mail").fill(USER_EMAIL);
  await sheet.getByLabel("Hasło").fill("e2e-test-pass");
  await sheet.getByRole("button", { name: "Zaloguj się", exact: true }).click();
}

test.describe("Typy pozycji w katalogu", () => {
  test("pierwsze logowanie pyta o typy, a odznaczone typy znikają z widoków bez usuwania", async ({ page }) => {
    const backend = await mockBackend(page, undefined, { collectionTypes: null });
    await signIn(page);

    await expect(page.getByRole("heading", { name: "Co kolekcjonujesz?" })).toBeVisible();
    const types = page.getByRole("group", { name: "Typy pozycji" });
    for (const name of ["Książki", "Muzyka", "Komiksy"]) {
      const button = types.getByRole("button", { name });
      if ((await button.getAttribute("aria-pressed")) === "true") await button.click();
    }
    if ((await types.getByRole("button", { name: "Gry" }).getAttribute("aria-pressed")) !== "true") {
      await types.getByRole("button", { name: "Gry" }).click();
    }
    await page.getByRole("button", { name: "Zapisz" }).click();

    await expect(page.getByRole("navigation", { name: "Nawigacja" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Gry" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Książki" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Muzyka" })).toHaveCount(0);

    // Udostępniony link pokazuje tylko wybrane typy.
    await page.goto(`/share/${USER_ID}`);
    await expect(page.getByTestId("item-card-g1")).toBeVisible();
    await expect(page.getByTestId("item-card-b1")).toHaveCount(0);

    expect(backend.deletes).toHaveLength(0);
  });

  test("zmiana typów w profilu przywraca ukryte pozycje", async ({ page }) => {
    await mockBackend(page, undefined, { collectionTypes: ["game"] });
    await signIn(page);
    await expect(page.getByRole("region", { name: "Gry" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Muzyka" })).toHaveCount(0);

    await openTab(page, "Profil");
    await page.getByRole("button", { name: "Więcej opcji" }).click();
    await page.getByRole("menuitem", { name: "Typy w katalogu" }).click();
    await page.getByRole("group", { name: "Typy pozycji" }).getByRole("button", { name: "Muzyka" }).click();
    await page.getByRole("button", { name: "Zapisz" }).click();

    await openTab(page, "Start");
    await expect(page.getByRole("region", { name: "Muzyka" }).getByTestId("item-card-m1")).toBeVisible();
  });
});
