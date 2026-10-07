import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockWorkspace, testProfile } from "./workspace-fixtures";

for (const width of [375, 768, 1024, 1440])
  for (const pageName of ["dashboard", "profile"]) {
    test(`${pageName} workspace accessible at ${width}px`, async ({ page }) => {
      await mockWorkspace(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${pageName}`);
      await expect(page.locator(".workspace-heading h1")).toBeVisible();
      for (const theme of ["dark", "light"]) {
        if (theme === "light")
          await page
            .getByRole("button", { name: "Switch to light mode" })
            .click();
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          result.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.map((node) => node.target),
          })),
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      if (pageName === "dashboard")
        await expect(
          page.getByRole("heading", { name: "No interviews yet." }),
        ).toBeVisible();
      if (width === 1440)
        await page.screenshot({
          path: `test-results/${pageName}.png`,
          fullPage: true,
        });
    });
  }

test("profile changes save with selected skills", async ({ page }) => {
  await mockWorkspace(page);
  let saved = false;
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PUT") {
      const data = route.request().postDataJSON();
      saved =
        data.target_role === "Backend Developer" &&
        data.skill_ids.includes("python");
    }
    await route.fulfill({ json: testProfile });
  });
  await page.goto("/profile");
  await page.getByLabel("Target role").fill("Backend Developer");
  await page.getByRole("checkbox", { name: "Python" }).check();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Your profile is saved.")).toBeVisible();
  expect(saved).toBe(true);
});

test("workspace failures offer retry", async ({ page }) => {
  await mockWorkspace(page);
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "The database is unavailable." },
    }),
  );
  await page.goto("/dashboard");
  await expect(page.locator(".form-error")).toContainText(
    "database is unavailable",
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
