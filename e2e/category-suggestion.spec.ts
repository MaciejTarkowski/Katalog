import { test, expect, mockBackend, login, openTab, pickCoverPhoto, SCANNED } from "./fixtures";

test.describe("3. Sugestia kategorii", () => {
  test("po rozpoznaniu propozycja ma kategorię i podkategorię, które trafiają do zapisu", async ({ page }) => {
    const backend = await mockBackend(page);
    await login(page);

    await openTab(page, "Dodaj");
    await pickCoverPhoto(page);
    await expect(page.getByText(`Muzyka · ${SCANNED.subcategory}`)).toBeVisible();

    await page.getByRole("button", { name: "Dodaj do kolekcji" }).click();
    await expect.poll(() => backend.inserts.length).toBe(1);
    // "Winyl" is saved as a code, shown in the UI language.
    expect(backend.inserts[0]).toMatchObject({ category: SCANNED.category, subcategory: "vinyl" });
  });

  test("po odrzuceniu można uzupełnić dane ręcznie i wybrać inną kategorię", async ({ page }) => {
    const backend = await mockBackend(page);
    await login(page);

    await openTab(page, "Dodaj");
    await pickCoverPhoto(page);
    await page.getByRole("button", { name: "Odrzuć" }).click();
    await page.getByRole("dialog", { name: "Nie ta pozycja?" }).getByRole("button", { name: /Uzupełnij ręcznie/ }).click();

    const form = page.getByRole("dialog", { name: "Uzupełnij ręcznie" });
    await form.getByLabel("Tytuł *").fill(SCANNED.title);
    await form.getByLabel("Kategoria", { exact: true }).selectOption("other");
    await form.getByRole("button", { name: "Dodaj do kolekcji" }).click();

    await expect(page.getByText(`Dodano „${SCANNED.title}” do kolekcji`)).toBeVisible();
    expect(backend.inserts[0]).toMatchObject({ title: SCANNED.title, category: "other" });
  });
});
