import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockWorkspace, testProfile, testUser } from "./workspace-fixtures";
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
  ai_enabled: false,
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
    ai_enabled: false,
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
            answer_text: body.answer_text.trim(),
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
    .fill("First I inspect the query execution plan.  ");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator(".draft-state")).toContainText("Draft saved");
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
    page.getByRole("link", { name: "View results" }),
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

test("AI choice is explicit and discloses context sharing", async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.route("**/api/interviews/capabilities", (route) =>
    route.fulfill({ json: { ai_available: true } }),
  );
  let requested = false;
  await page.route("**/api/interviews", (route) => {
    requested = route.request().postDataJSON().ai_enabled;
    return route.fulfill({
      status: 201,
      json: { ...active, status: "created", ai_enabled: true },
    });
  });
  await page.route(`**/api/interviews/${id}`, (route) =>
    route.fulfill({ json: { ...active, status: "created", ai_enabled: true } }),
  );
  await page.goto("/interviews/new");
  const choice = page.getByRole("checkbox", {
    name: "Use AI-assisted questions",
  });
  await expect(choice).toBeEnabled();
  await expect(choice).not.toBeChecked();
  await expect(page.locator("#ai-privacy")).toContainText("sent to OpenAI");
  await choice.check();
  await page.getByRole("button", { name: "Create interview" }).click();
  await expect(
    page.getByRole("button", { name: "Begin interview" }),
  ).toBeVisible();
  expect(requested).toBe(true);
});

test("no key leaves curated practice available", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/interviews/new");
  await expect(
    page.getByRole("checkbox", { name: "Use AI-assisted questions" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Create interview" }),
  ).toBeEnabled();
  await expect(page.locator("#ai-privacy")).toContainText(
    "Curated questions are ready",
  );
});

test("unsaved edits block workspace navigation until user chooses to leave", async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.route(`**/api/interviews/${id}`, (route) =>
    route.fulfill({ json: active }),
  );
  await page.goto(`/interviews/${id}`);
  await page
    .getByLabel("Your answer", { exact: true })
    .fill("Unsaved reasoning.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Overview" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${id}$`));
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(
    "Unsaved reasoning.",
  );
});

test("long display names keep header within laptop width", async ({ page }) => {
  await mockWorkspace(page);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: { ...testUser, display_name: "Candidate".repeat(8) },
    }),
  );
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/dashboard");
  await expect(page.locator(".header-user")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("preparing status leads to next fallback question without losing answer", async ({
  page,
}) => {
  await mockWorkspace(page);
  const current = {
    ...active,
    ai_enabled: true,
    questions: [{ ...question, source: "ai" }],
  };
  await page.route(`**/api/interviews/${id}`, (route) =>
    route.fulfill({ json: current }),
  );
  let release: (() => void) | undefined;
  await page.route(
    `**/api/interviews/${id}/questions/q-one/answer`,
    async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      const submitted = route.request().postDataJSON();
      await route.fulfill({
        json: {
          ...current,
          answered_count: 1,
          current_sequence: 2,
          questions: [
            {
              ...question,
              answer_text: submitted.answer_text,
              answered_at: "2026-01-01T00:01:00Z",
            },
            {
              ...question,
              id: "q-two",
              sequence: 2,
              difficulty: "Beginner",
              question_text:
                "What is an index and how does it affect a database write?",
            },
          ],
        },
      });
    },
  );
  await page.goto(`/interviews/${id}`);
  await expect(
    page.getByText("AI-assisted question", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Your answer", { exact: true })
    .fill("A short explanation.");
  await page.getByRole("button", { name: "Save & next" }).click();
  await expect(
    page.getByRole("button", { name: "Preparing next question…" }),
  ).toBeDisabled();
  await expect.poll(() => Boolean(release)).toBe(true);
  release?.();
  await expect(
    page.getByRole("heading", {
      name: "What is an index and how does it affect a database write?",
    }),
  ).toBeVisible();
  await expect(page.locator(".question-origin")).toContainText(
    "Curated question",
  );
  await expect(page.locator(".question-origin")).toContainText("not a score");
});
