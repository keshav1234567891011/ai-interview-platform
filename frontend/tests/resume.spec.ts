import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockWorkspace, testSkills } from "./workspace-fixtures";

for (const width of [375, 1440])
  for (const routeName of ["resume", "jobs/analyze"]) {
    test(`${routeName} accessible at ${width}px`, async ({ page }) => {
      await mockWorkspace(page);
      await page.route("**/api/resumes", (route) =>
        route.fulfill({ json: [] }),
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${routeName}`);
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
    });
  }

test("job analysis shows real response match and suitability disclaimer", async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.route("**/api/jobs/analyze", (route) =>
    route.fulfill({
      status: 201,
      json: {
        id: "job-test",
        required_skills: testSkills,
        preferred_skills: [],
        matched_skills: [testSkills[0]],
        missing_skills: [testSkills[1]],
        role_keywords: [],
        match_percentage: 50,
        candidate_source: "profile",
        disclaimer:
          "Baseline vocabulary matching, not an employment suitability judgment.",
      },
    }),
  );
  await page.goto("/jobs/analyze");
  await page
    .getByLabel("Target job description")
    .fill("Required: Python and SQL for a Backend Developer.");
  await page.getByRole("button", { name: "Analyze description" }).click();
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Baseline vocabulary matching, not an employment suitability judgment.",
    ),
  ).toBeVisible();
});

test("resume upload handles malformed server response", async ({ page }) => {
  await mockWorkspace(page);
  await page.route("**/api/resumes", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 422,
          json: { detail: "This document could not be read safely." },
        })
      : route.fulfill({ json: [] }),
  );
  await page.goto("/resume");
  await page.locator("input[type=file]").setInputFiles({
    name: "malformed.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-invalid"),
  });
  await page
    .getByRole("button", { name: "Upload resume", exact: true })
    .click();
  await expect(page.locator(".form-error")).toContainText(
    "could not be read safely",
  );
});
