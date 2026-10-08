import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockWorkspace, testUser, testProfile } from "./workspace-fixtures";
const userId = testUser.id;
const history = [{ id: "session-1", role: "Backend Developer", difficulty: "Intermediate", status: "completed", created_at: "2026-01-01T00:00:00Z", completed_at: "2026-01-01T00:05:00Z", question_count: 1, answered_count: 1, score: 61, technical_score: 60, communication_score: 72, duration_seconds: 300 }];
const analytics = { completed_interviews: 1, evaluated_interviews: 1, averages: { score: 61, technical_score: 60, reasoning_score: 55, communication_score: 72 }, latest_score: 61, best_score: 61, trend: [{ id: "session-1", role: "Backend Developer", date: "2026-01-01T00:05:00Z", score: 61, technical_score: 60, reasoning_score: 55, communication_score: 72 }], topics: [{ topic: "dbms", score: 61, observations: 1 }], insights: [] };
const scheduled = { id: "scheduled-1", role: "Backend Developer", difficulty: "Intermediate", focus_areas: [], question_count: 1, ai_enabled: false, scheduled_at: "2040-01-01T12:00:00Z", created_at: "2026-01-01T00:00:00Z", status: "scheduled", interview_id: null };
const session = { ...history[0], id: "live-session", status: "in_progress", answered_count: 0, ai_enabled: false, current_sequence: 1, questions: [{ id: "q1", sequence: 1, question_text: "Explain database indexing and its trade-offs.", category: "dbms", difficulty: "Intermediate", source: "question_bank", answer_text: "", answered_at: null }] };
async function mocks(page: Page, admin = true) {
  await mockWorkspace(page);
  await page.route("**/api/auth/me", route => route.fulfill({ json: { ...testUser, role: admin ? "admin" : "user" } }));
  await page.route("**/api/scheduled", route => route.fulfill({ json: [scheduled] }));
  await page.route("**/api/history?**", route => route.fulfill({ json: history }));
  await page.route("**/api/analytics", route => route.fulfill({ json: analytics }));
  await page.route("**/api/admin", route => route.fulfill({ json: { total_users: 1, active_users: 1, total_interviews: 1, completed_interviews: 1, resume_count: 0, scheduled_interviews: 1 } }));
  await page.route("**/api/admin/users?**", route => route.fulfill({ json: [{ ...testUser, role: "user" }] }));
  await page.route(`**/api/admin/users/${userId}`, route => route.fulfill({ json: { user: { ...testUser, role: "user" }, profile: testProfile, interviews: history, resumes: [], scheduled: [scheduled] } }));
  await page.route("**/api/interviews/live-session", route => route.fulfill({ json: session }));
}
for (const width of [375, 1440]) for (const view of ["interviews/scheduled", "interviews/history", "analytics", "admin", "admin/users", `admin/users/${userId}`]) {
  test(`${view} accessible at ${width}px`, async ({ page }) => {
    await mocks(page); await page.emulateMedia({ reducedMotion: "reduce" }); await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/${view}`); await expect(page.locator(".workspace-heading h1")).toBeVisible();
    if (view === "analytics") await expect(page.locator(".recharts-wrapper")).toBeVisible();
    for (const theme of ["dark", "light"]) {
      if (theme === "light") await page.getByRole("button", { name: "Switch to light mode" }).click();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    if (width === 1440 && view === "analytics") await page.screenshot({ path: "test-results/analytics-review.png", fullPage: true });
  });
}
test("schedule creation converts browser local time to UTC", async ({ page }) => {
  await mocks(page, false);
  let payload: Record<string, unknown> = {};
  await page.route("**/api/scheduled", route => {
    if (route.request().method() === "POST") { payload = route.request().postDataJSON(); return route.fulfill({ status: 201, json: scheduled }); }
    return route.fulfill({ json: [scheduled] });
  });
  await page.goto("/interviews/new"); await page.getByRole("radio", { name: "Schedule interview", exact: true }).check();
  await page.getByLabel("Interview date and time").fill("2040-01-01T12:00");
  const expected = await page.evaluate(() => new Date("2040-01-01T12:00").toISOString());
  await page.getByRole("button", { name: "Schedule interview", exact: true }).click();
  await expect(page).toHaveURL(/\/interviews\/scheduled$/); expect(payload.scheduled_at).toBe(expected);
});
test("reschedule and cancel update the workspace", async ({ page }) => {
  await mocks(page, false); let item = { ...scheduled };
  await page.route("**/api/scheduled", route => route.fulfill({ json: [item] }));
  await page.route("**/api/scheduled/scheduled-1", route => { item = { ...item, scheduled_at: route.request().postDataJSON().scheduled_at }; return route.fulfill({ json: item }); });
  await page.route("**/api/scheduled/scheduled-1/cancel", route => { item = { ...item, status: "cancelled" }; return route.fulfill({ json: item }); });
  await page.goto("/interviews/scheduled"); await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  await page.getByLabel("New local date and time").fill("2040-02-01T10:00"); await page.getByRole("button", { name: "Save schedule" }).click();
  await expect(page.getByLabel("New local date and time")).toHaveCount(0);
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reschedule", exact: true })).toHaveCount(0);
  await expect(page.locator(".schedule-card")).toContainText("cancelled");
});
test("ordinary user is denied the admin UI", async ({ page }) => {
  await mocks(page, false); await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administrator access required." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Administration", exact: true })).toHaveCount(0);
});
test("admin safe-field save persists and confirms success", async ({ page }) => {
  await mocks(page); let user = { ...testUser, role: "user" }; let payload: Record<string, unknown> = {};
  await page.route(`**/api/admin/users/${userId}`, route => {
    if (route.request().method() === "PUT") { payload = route.request().postDataJSON(); user = { ...user, display_name: String(payload.display_name), is_active: Boolean(payload.is_active) }; return route.fulfill({ json: user }); }
    return route.fulfill({ json: { user, profile: { ...testProfile, display_name: user.display_name }, interviews: history, resumes: [], scheduled: [] } });
  });
  await page.goto(`/admin/users/${userId}`); await page.getByLabel("Display name", { exact: true }).fill("Updated Candidate");
  await page.getByRole("button", { name: "Save safe fields" }).click();
  await expect(page.getByText("Account updated.", { exact: true })).toBeVisible();
  expect(payload).toEqual({ display_name: "Updated Candidate", is_active: true });
  await page.reload(); await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Updated Candidate");
});
test("empty analytics does not fabricate scores", async ({ page }) => {
  await mocks(page, false); await page.route("**/api/analytics", route => route.fulfill({ json: { ...analytics, completed_interviews: 0, evaluated_interviews: 0, latest_score: null, best_score: null, averages: { score: null }, topics: [], trend: [], insights: [] } }));
  await page.goto("/analytics"); await expect(page.getByRole("heading", { name: "Your first data point starts with practice." })).toBeVisible();
  await expect(page.locator(".recharts-wrapper")).toHaveCount(0);
});
test("WebGL failure preserves question and text controls", async ({ page }) => {
  await mocks(page, false); await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => { Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 }); const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) { return args[0] === "webgl2" ? null : original.apply(this, args); } as typeof original; });
  await page.goto("/interviews/live-session"); await page.getByRole("checkbox", { name: "Enable 3D interviewer" }).check();
  await expect(page.getByText("3D rendering unavailable", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: session.questions[0].question_text })).toBeVisible();
  await expect(page.getByLabel("Your answer", { exact: true })).toBeEnabled();
});
test("reduced motion and unavailable speech use static text fallback", async ({ page }) => {
  await mocks(page, false); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => { Object.defineProperty(window, "speechSynthesis", { value: undefined }); Object.defineProperty(window, "SpeechSynthesisUtterance", { value: undefined }); });
  await page.goto("/interviews/live-session"); await expect(page.getByRole("checkbox", { name: "Enable 3D interviewer" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Read question aloud" })).toBeDisabled();
  await expect(page.getByText("Question audio is unsupported", { exact: false })).toBeVisible();
});
