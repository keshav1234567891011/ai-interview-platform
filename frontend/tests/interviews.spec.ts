import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockWorkspace, testProfile } from "./workspace-fixtures";
const id = "3aedf9a2-6b2a-4659-9338-4aafcc6a4a95";
const question = {
  id: "q-one",
  sequence: 1,
  question_text:
    "Explain how you would investigate a slow database query, including the trade-offs in index design.",
  category: "dbms",
  difficulty: "Intermediate",
  source: "question_bank",
  answer_text: "",
  answered_at: null,
};
const active = {
  id,
  role: "Backend Developer",
  difficulty: "Intermediate",
  status: "in_progress",
  created_at: "2026-01-01T00:00:00Z",
  started_at: "2026-01-01T00:00:00Z",
  completed_at: null,
  question_count: 2,
  answered_count: 0,
  focus_areas: [],
  duration_seconds: null,
  current_sequence: 1,
  questions: [question],
};

for (const width of [375, 1440])
  for (const view of ["interviews", "interviews/new", `interviews/${id}`]) {
    test(`${view} accessible at ${width}px`, async ({ page }) => {
      await mockWorkspace(page);
      await page.route("**/api/interviews", (route) =>
        route.fulfill({ json: [] }),
      );
      await page.route(`**/api/interviews/${id}`, (route) =>
        route.fulfill({ json: active }),
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/${view}`);
      await expect(page.locator(".workspace-heading h1")).toBeVisible();
      for (const theme of ["dark", "light"]) {
        if (theme === "light")
          await page
            .getByRole("button", { name: "Switch to light mode" })
            .click();
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          results.violations.map((item) => ({
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
      if (width === 1440)
        await page.screenshot({
          path: `test-results/${view.includes("new") ? "setup" : view.includes(id) ? "session" : "interviews"}.png`,
          fullPage: true,
        });
    });
  }

test("setup submits role, focus, difficulty, and question count", async ({
  page,
}) => {
  await mockWorkspace(page);
  let payload: Record<string, unknown> = {};
  await page.route("**/api/interviews", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { ...active, status: "created" },
    });
  });
  await page.route(`**/api/interviews/${id}`, (route) =>
    route.fulfill({ json: { ...active, status: "created" } }),
  );
  await page.goto("/interviews/new");
  await page.getByLabel("Target role").selectOption("Python Developer");
  await page.getByLabel("Difficulty", { exact: true }).selectOption("Advanced");
  await page.getByLabel("Questions", { exact: true }).selectOption("3");
  await page.getByRole("checkbox", { name: "Python" }).check();
  await page.getByRole("button", { name: "Create interview" }).click();
  await expect(
    page.getByRole("button", { name: "Begin interview" }),
  ).toBeVisible();
  expect(payload).toEqual({
    role: "Python Developer",
    difficulty: "Advanced",
    question_count: 3,
    focus_areas: ["python"],
  });
});

test("draft survives reload and answer progresses to real completion", async ({
  page,
}) => {
  await mockWorkspace(page);
  let session = { ...active, question_count: 1 };
  await page.route(`**/api/interviews/${id}`, (route) =>
    route.fulfill({ json: session }),
  );
  await page.route(
    `**/api/interviews/${id}/questions/q-one/answer`,
    async (route) => {
      const body = route.request().postDataJSON();
      session = {
        ...session,
        questions: [
          {
            ...question,
            answer_text: body.answer_text,
            answered_at: body.submit ? "2026-01-01T00:01:00Z" : null,
          },
        ],
        ...(body.submit
          ? {
              status: "completed",
              answered_count: 1,
              current_sequence: null,
              completed_at: "2026-01-01T00:01:00Z",
              duration_seconds: 60,
            }
          : {}),
      } as typeof session;
      await route.fulfill({ json: session });
    },
  );
  await page.goto(`/interviews/${id}`);
  await page
    .getByLabel("Your answer", { exact: true })
    .fill("First I inspect the query execution plan.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  await page.reload();
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    "First I inspect the query execution plan.",
  );
  await page.getByRole("button", { name: "Finish interview" }).click();
  await expect(
    page.getByRole("heading", { name: "Interview complete." }),
  ).toBeVisible();
  await expect(
    page.getByText("1 of 1 questions answered · 1m 0s."),
  ).toBeVisible();
  await expect(
    page.getByText("Detailed evaluation will be added", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Overall score", { exact: false })).toHaveCount(
    0,
  );
});

test("dashboard shows saved interview history without invented scores", async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      json: {
        profile: testProfile,
        recent_interviews: [active],
        interview_count: 1,
      },
    }),
  );
  await page.goto("/dashboard");
  await expect(page.locator(".session-row")).toContainText("Backend Developer");
  await expect(page.locator(".session-row")).toContainText("in progress");
  await expect(
    page.getByRole("heading", { name: "No interviews yet." }),
  ).toHaveCount(0);
});
