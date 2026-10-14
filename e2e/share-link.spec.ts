import {
  test,
  expect,
  mockBackend,
  login,
  SEED_ITEMS,
  USER_ID,
  USER_DISPLAY_NAME,
  makeItem,
} from "./fixtures";

test.describe("5. Link udostępniania", () => {
  test("przycisk udostępniania kopiuje link /share/<userId>", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
    await mockBackend(page);
    await login(page);

    await page.getByRole("button", { name: /Udostępnij moją kolekcję/ }).click();
    await expect(page.getByText("Skopiowano link do schowka")).toBeVisible();

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(`${baseURL}/share/${USER_ID}`);
  });

  test("kolekcja jest widoczna dla niezalogowanego gościa", async ({ page }) => {
    await mockBackend(page, [
      ...SEED_ITEMS,
      makeItem({ id: "x1", title: "Cudzy element", user_id: "someone-else" }),
    ]);
    await page.goto(`/share/${USER_ID}`);

    for (const item of SEED_ITEMS) {
      await expect(page.getByTestId(`item-card-${item.id}`)).toBeVisible();
    }
    await expect(page.getByText("Cudzy element")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: `Kolekcja użytkownika ${USER_DISPLAY_NAME}` })
    ).toBeVisible();

    const tabs = page.getByRole("tablist", { name: "Kategorie" });
    await tabs.getByRole("tab", { name: "Muzyka" }).click();
    await expect(page.getByTestId(/^item-card-/)).toHaveCount(1);
  });

  test("w widoku udostępnionym nie da się edytować kolekcji", async ({ page }) => {
    const backend = await mockBackend(page);
    await page.goto(`/share/${USER_ID}`);
    await expect(page.getByTestId("item-card-b1")).toBeVisible();

    await expect(page.getByRole("button", { name: /^Usuń/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Dodaj przedmiot/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dodaj do kolekcji" })).toHaveCount(0);
    await expect(page.locator("input:not([type=hidden]):not([type=search]), select, textarea")).toHaveCount(0);
    expect(backend.writes).toHaveLength(0);
  });

  test("właściciel oglądający własny link też nie ma edycji", async ({ page }) => {
    await mockBackend(page);
    await login(page);
    await page.goto(`/share/${USER_ID}`);
    await expect(page.getByTestId("item-card-b1")).toBeVisible();

    await expect(page.getByRole("button", { name: /^Usuń/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Dodaj przedmiot/ })).toHaveCount(0);
  });
});
