import { expect, test } from "@playwright/test";

test.describe("premium frontend shell", () => {
  test("public home keeps the operational dashboard composition on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Veja como o processo realmente acontece." })).toBeVisible();
    await expect(page.getByLabel("Preview sintético do workspace ProcessTwin")).toBeVisible();
    await expect(page.getByRole("link", { name: "Criar workspace" })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);

    await page.screenshot({ path: "test-results/premium-home-desktop.png", fullPage: true });
  });

  test("public home remains usable without horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Veja como o processo realmente acontece." })).toBeVisible();
    await expect(page.getByLabel("Preview sintético do workspace ProcessTwin")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);

    await page.screenshot({ path: "test-results/premium-home-mobile.png", fullPage: true });
  });
});
