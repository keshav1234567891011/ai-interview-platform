import { test, expect } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import development from "../../config/development.json";

const root = path.resolve(__dirname, "../..");

test("real browser account, profile, logout, and curated interview persist in PostgreSQL", async ({ page, context }) => {
  const email = `interviewai-validation-${randomUUID().replaceAll("-", "")}@example.com`;
  const password = `${randomBytes(36).toString("base64url")}A9`;
  let userId: string | undefined;
  let stage = "health and docs";
  function database(action: string, extra: Record<string, unknown> = {}) {
    const result = spawnSync(
      path.join(root, "backend", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"),
      [path.join(root, "scripts", "validation_database.py")],
      {
        cwd: path.join(root, "backend"),
        input: JSON.stringify({ action, email, user_id: userId, ...extra }),
        encoding: "utf8",
        timeout: 20_000,
        windowsHide: true,
      },
    );
    if (result.status !== 0 || !result.stdout.includes('"passed": true')) {
      throw new Error(`Temporary-account database ${action} check failed; private details suppressed.`);
    }
  }
  function passed() { console.log(`Live browser ${stage}: passed.`); }
  async function login() {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const response = page.waitForResponse(r => r.url().endsWith("/api/auth/login") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator(".workspace-heading h1")).toBeVisible();
  }
  try {
    const backend = `http://${development.backend.host}:${development.backend.port}`;
    const health = await page.request.get(`${backend}/health`);
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect((await page.request.get(`${backend}/docs`)).status()).toBe(200);
    expect((await page.request.get(`${backend}/ready`)).status()).toBe(200);
    passed();
    stage = "landing and API proxy";
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Practice Smarter/ })).toBeVisible();
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    passed();
    stage = "registration";
    await page.goto("/register");
    await page.getByLabel("Display name").fill("InterviewAI validation");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const registered = page.waitForResponse(r => r.url().endsWith("/api/auth/register") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    const registration = await registered;
    expect(registration.status()).toBe(201);
    userId = (await registration.json()).id;
    await expect(page).toHaveURL(/\/dashboard$/);
    passed();
    stage = "authenticated session and dashboard";
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(200);
    expect((await me.json()).id).toBe(userId);
    const cookies = await context.cookies();
    expect(cookies.some(cookie => cookie.name === "interviewai_session" && cookie.httpOnly && cookie.sameSite === "Lax")).toBe(true);
    await expect(page.getByRole("heading", { name: "No interviews yet." })).toBeVisible();
    passed();
    stage = "first logout";
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/(login)?$/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    passed();
    stage = "login";
    await login();
    passed();
    stage = "profile save and PostgreSQL persistence";
    await page.goto("/profile");
    await page.getByLabel("Display name").fill("InterviewAI validation updated");
    await page.getByLabel("Target role").fill("Backend Developer");
    await page.getByLabel("Experience level").selectOption("entry");
    await page.getByLabel("Professional summary").fill("Temporary browser validation of local persistence.");
    await page.getByRole("checkbox", { name: "Python", exact: true }).check();
    await page.getByRole("checkbox", { name: "PostgreSQL", exact: true }).check();
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByText("Your profile is saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Target role")).toHaveValue("Backend Developer");
    await expect(page.getByRole("checkbox", { name: "Python", exact: true })).toBeChecked();
    database("profile");
    passed();
    stage = "logout removes protected access";
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/(login)?$/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);
    passed();
    stage = "login again and resume workspace";
    await login();
    await page.goto("/resume");
    await expect(page.getByRole("heading", { name: "Give your preparation a starting point." })).toBeVisible();
    stage = "synthetic resume upload and persistence";
    const document = spawnSync(
      path.join(root, "backend", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"),
      ["-c", "from docx import Document; from io import BytesIO; import sys; d=Document(); d.add_paragraph('InterviewAI validation. Python PostgreSQL SQL Docker FastAPI.'); b=BytesIO(); d.save(b); sys.stdout.buffer.write(b.getvalue())"],
      { cwd: path.join(root, "backend"), timeout: 10_000, windowsHide: true },
    );
    if (document.status !== 0) throw new Error("Synthetic validation document generation failed.");
    await page.locator("#resume-file").setInputFiles({ name: "interviewai-validation.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: document.stdout });
    const upload = page.waitForResponse(r => r.url().endsWith("/api/resumes") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Upload resume", exact: true }).click();
    expect((await upload).status()).toBe(201);
    await page.reload();
    await expect(page.getByRole("heading", { name: "interviewai-validation.docx", exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Python", exact: true })).toBeChecked();
    passed();
    stage = "job analysis workspace";
    await page.goto("/jobs/analyze");
    await expect(page.getByRole("heading", { name: "Find your next focus." })).toBeVisible();
    await page.getByLabel("Target job description").fill("Backend Developer. Required: Python, PostgreSQL, SQL and Docker. Preferred: FastAPI.");
    const analysis = page.waitForResponse(r => r.url().endsWith("/api/jobs/analyze") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Analyze description", exact: true }).click();
    const analyzed = await analysis;
    expect(analyzed.status()).toBe(201);
    expect((await analyzed.json()).candidate_source).toBe("resume");
    passed();
    stage = "interview setup";
    await page.goto("/interviews/new");
    await page.getByLabel("Target role").selectOption("Backend Developer");
    await page.getByLabel("Difficulty", { exact: true }).selectOption("Beginner");
    await page.getByLabel("Questions", { exact: true }).selectOption("3");
    await expect(page.getByRole("checkbox", { name: "Use AI-assisted questions" })).not.toBeChecked();
    passed();
    stage = "deterministic interview creation";
    const created = page.waitForResponse(r => r.url().endsWith("/api/interviews") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Create interview", exact: true }).click();
    const creation = await created;
    expect(creation.status()).toBe(201);
    const interview = await creation.json();
    expect(interview.ai_enabled).toBe(false);
    passed();
    stage = "begin interview";
    await page.getByRole("button", { name: "Begin interview", exact: true }).click();
    await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
    passed();
    stage = "answer and session recovery";
    const answer = "I inspect the execution plan, measure query latency, and evaluate selective indexes while accounting for their storage and write overhead.";
    await page.getByLabel("Your answer", { exact: true }).fill(answer);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.locator(".draft-state")).toContainText("Draft saved");
    await page.reload();
    await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(answer);
    const submitted = page.waitForResponse(r => r.url().endsWith("/answer") && r.request().method() === "PUT");
    await page.getByRole("button", { name: "Save & next", exact: true }).click();
    const submission = await submitted;
    expect(submission.status()).toBe(200);
    expect((await submission.json()).answered_count).toBe(1);
    await page.reload();
    await expect(page.getByRole("progressbar", { name: "Questions answered" })).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue("");
    database("interview", { interview_id: interview.id, answer });
    passed();
    stage = "completed interview and stored baseline results";
    for (let index = 1; index < 3; index++) {
      await page.getByLabel("Your answer", { exact: true }).fill("I define the concept, explain the approach because correctness matters, and use a practical example with a trade-off.");
      await page.getByRole("button", { name: index === 2 ? "Finish interview" : "Save & next", exact: true }).click();
      if (index === 1) await expect(page.getByRole("progressbar", { name: "Questions answered" })).toHaveAttribute("aria-valuenow", "2");
    }
    await page.getByRole("link", { name: "View results", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your interview report." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Communication Analysis" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your interview report." })).toBeVisible();
    database("evaluation", { interview_id: interview.id });
    passed();
    stage = "real history and analytics";
    await page.goto("/interviews/history");
    await expect(page.getByRole("heading", { name: "Interview history." })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.goto("/analytics");
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
    passed();
    stage = "scheduling rescheduling cancellation and due-session start";
    await page.goto("/interviews/new");
    await page.getByLabel("Questions", { exact: true }).selectOption("1");
    await page.getByRole("radio", { name: "Schedule interview", exact: true }).check();
    const localFuture = await page.evaluate(() => { const date = new Date(Date.now() + 3600000); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
    await page.getByLabel("Interview date and time").fill(localFuture);
    const scheduling = page.waitForResponse(r => r.url().endsWith("/api/scheduled") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Schedule interview", exact: true }).click();
    const scheduleResponse = await scheduling;
    expect(scheduleResponse.status()).toBe(201);
    const schedule = await scheduleResponse.json();
    await page.getByRole("button", { name: "Reschedule", exact: true }).click();
    await page.getByLabel("New local date and time").fill(localFuture);
    await page.getByRole("button", { name: "Save schedule", exact: true }).click();
    await expect(page.getByLabel("New local date and time")).toHaveCount(0);
    database("temporary-schedule-due", { schedule_id: schedule.id });
    await page.getByRole("button", { name: "Refresh schedule", exact: true }).click();
    await page.getByRole("button", { name: "Start Interview", exact: true }).click();
    await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
    await page.goto("/interviews/new");
    await page.getByRole("radio", { name: "Schedule interview", exact: true }).check();
    await page.getByLabel("Interview date and time").fill(localFuture);
    await page.getByRole("button", { name: "Schedule interview", exact: true }).click();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);
    passed();
    stage = "ordinary-user admin denial";
    expect((await page.request.get("/api/admin")).status()).toBe(403);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administrator access required." })).toBeVisible();
    passed();
    stage = "controlled temporary-admin validation";
    database("temporary-admin");
    await page.goto("/login");
    await page.reload();
    await login();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin overview." })).toBeVisible();
    await page.goto(`/admin/users/${userId}`);
    await expect(page.getByRole("heading", { name: "InterviewAI validation updated", exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Account active" })).toBeDisabled();
    const details = await page.request.get(`/api/admin/users/${userId}`);
    expect(details.status()).toBe(200);
    const safeFields = Object.keys((await details.json()).user);
    expect(safeFields.includes("hashed_password")).toBe(false);
    expect(safeFields.includes("token_version")).toBe(false);
    passed();
    stage = "final logout";
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/(login)?$/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    passed();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.log("Private-safe browser failure categories:", {
      assertion: message.includes("expect("),
      strictLocator: message.includes("strict mode violation"),
      locatorTimeout: message.includes("Timeout"),
      checkedAssertion: message.includes("toBeChecked"),
      visibleAssertion: message.includes("toBeVisible"),
      clickFailure: message.includes("locator.click"),
      selectFailure: message.includes("selectOption"),
      unexpectedStatus: message.includes("toBe("),
    });
    throw new Error(`Live browser validation failed during ${stage}; private error details suppressed.`);
  } finally {
    database("cleanup");
    console.log("Temporary validation account and dependent records removed; existing users untouched.");
  }
});
