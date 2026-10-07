import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Please sign in" } }),
  );
});

for (const width of [375, 1440]) {
  for (const mode of ["login", "register"]) {
    test(`${mode} accessible at ${width}px in both themes`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${mode}`);
      for (const theme of ["dark", "light"]) {
        if (theme === "light")
          await page
            .getByRole("button", { name: "Switch to light mode" })
            .click();
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(result.violations.map((item) => item.id)).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    });
  }
}

test("login submits, exposes accessible errors and toggles password", async ({
  page,
}) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: { detail: "Email or password is incorrect." },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill("candidate@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Wrong-test-password42");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".form-error[role='alert']")).toContainText(
    "Email or password is incorrect",
  );
});

test("protected workspace redirects anonymous users", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
});
