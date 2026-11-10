import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mockWorkspace, testUser, testAISettings } from "./workspace-fixtures";

test.beforeEach(async ({ page }) => {
  await mockWorkspace(page);
  await page.route("**/api/auth/me", route => route.fulfill({ json: { ...testUser, role: "owner" } }));
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: testAISettings }));
});

test("owner stores and replaces a key, inputs clear and saved keys never appear", async ({ page }) => {
  let state = { ...testAISettings }; let received: Record<string, string> = {};
  await page.route("**/api/owner/ai-settings/key", route => {
    received = route.request().postDataJSON();
    state = { ...state, configured: true, database_key_present: true, credential_source: "database", fallback_active: false };
    return route.fulfill({ json: state });
  });
  await page.goto("/owner/ai-settings");
  const secret = "sk-" + randomBytes(36).toString("base64url");
  await expect(page.getByLabel("New API key", { exact: true })).toHaveValue("");
  await page.getByLabel("New API key", { exact: true }).fill(secret);
  await page.getByLabel("Confirm new API key", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Save API Key", exact: true }).click();
  await expect(page.getByText("AI settings saved.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("New API key", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Confirm new API key", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Replace API Key", exact: true })).toBeVisible();
  expect(received.api_key === secret && received.confirm_api_key === secret).toBe(true);
  expect(await page.locator("body").innerText()).not.toContain(secret);
});

test("mismatched key confirmation prevents submission and server errors remain actionable", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/owner/ai-settings/key", route => { requests++; return route.fulfill({ status: 503, json: { detail: "Settings encryption unavailable. Ask the operator to check it." } }); });
  await page.goto("/owner/ai-settings");
  const first = "sk-" + randomBytes(36).toString("hex");
  await page.getByLabel("New API key", { exact: true }).fill(first);
  await page.getByLabel("Confirm new API key", { exact: true }).fill("sk-" + randomBytes(36).toString("hex"));
  await page.getByRole("button", { name: "Save API Key", exact: true }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText("must match"); expect(requests).toBe(0);
  await page.getByLabel("Confirm new API key", { exact: true }).fill(first);
  await page.getByRole("button", { name: "Save API Key", exact: true }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText("encryption unavailable");
});

test("owner models and disabling provider are explicit server-validated updates", async ({ page }) => {
  let payload: Record<string, unknown> = {};
  await page.route("**/api/owner/ai-settings", route => {
    if (route.request().method() === "PUT") { payload = route.request().postDataJSON(); return route.fulfill({ json: { ...testAISettings, ...payload, fallback_active: true } }); }
    return route.fulfill({ json: testAISettings });
  });
  await page.goto("/owner/ai-settings"); await page.getByLabel("Legacy OpenAI text model (unused by interviews)", { exact: true }).selectOption("gpt-5-nano"); await page.getByLabel("Transcription model", { exact: true }).selectOption("gpt-4o-transcribe"); await page.getByRole("checkbox", { name: "Enable AI provider" }).uncheck();
  await page.getByRole("button", { name: "Save provider settings" }).click();
  await expect(page.getByText("AI settings saved.", { exact: false })).toBeVisible();
  expect(payload).toEqual({ enabled: false, text_model: "gpt-5-nano", transcription_model: "gpt-4o-transcribe" });
  await expect(page.getByRole("button", { name: "Test Connection" })).toBeDisabled();
});

test("connection tests are deliberate and removing the database key preserves fallback", async ({ page }) => {
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: { ...testAISettings, configured: true, database_key_present: true, credential_source: "database" } }));
  let tested = false;
  await page.route("**/api/owner/ai-settings/test", route => { tested = true; return route.fulfill({ json: { status: "connected" } }); });
  await page.route("**/api/owner/ai-settings/key", route => { expect(route.request().method()).toBe("DELETE"); return route.fulfill({ json: testAISettings }); });
  await page.goto("/owner/ai-settings"); expect(tested).toBe(false);
  await page.getByRole("button", { name: "Test Connection" }).click();
  await expect(page.getByText("Connected.", { exact: false })).toBeVisible(); expect(tested).toBe(true);
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Remove database API Key" }).click();
  await expect(page.getByRole("button", { name: "Remove database API Key" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save API Key", exact: true })).toBeVisible();
});

for (const role of ["user", "admin"]) test(`${role} cannot open owner AI settings`, async ({ page }) => {
  await page.route("**/api/auth/me", route => route.fulfill({ json: { ...testUser, role, permissions: ["users.view", "users.manage", "analytics.view"] } }));
  let accessed = false; await page.route("**/api/owner/ai-settings", route => { accessed = true; return route.fulfill({ status: 403 }); });
  await page.goto("/owner/ai-settings"); await expect(page.getByRole("heading", { name: "Owner access required." })).toBeVisible(); expect(accessed).toBe(false);
});

test("missing encryption configuration blocks key inputs but keeps deterministic controls", async ({ page }) => {
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: { ...testAISettings, encryption_status: "missing" } }));
  await page.goto("/owner/ai-settings"); await expect(page.getByLabel("New API key", { exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Save API Key", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Save provider settings" })).toBeEnabled();
});


test("Gemini probe is separate and requires a deliberate click", async ({ page }) => {
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: {
    ...testAISettings, gemini_configured: true, gemini_available: true, gemini_model: "gemini-3.1-flash-lite"
  } }));
  let calls = 0;
  await page.route("**/api/owner/ai-settings/test-gemini", route => {
    calls++;
    return route.fulfill({ json: { status: "connected" } });
  });
  await page.goto("/owner/ai-settings");
  await expect(page.getByText("Configured; live connection unverified", { exact: false })).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Test Gemini connection" }).click();
  await expect(page.getByRole("status")).toContainText("Gemini connection successful");
  expect(calls).toBe(1);
});


for (const [status, message] of [
  ["rate_limited", "Gemini quota exhausted or rate limit reached"],
  ["timeout", "Gemini connection timed out"],
  ["authentication_failed", "Gemini rejected the API key"],
  ["provider_unavailable", "Gemini could not return a valid response"],
  ["network", "reach the server"],
  ["local_limit", "Connection test request limit reached"],
]) test(`Gemini ${status} displays feedback beside the button`, async ({ page }) => {
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: {
    ...testAISettings, gemini_available: true,
  } }));
  let calls = 0;
  await page.route("**/api/owner/ai-settings/test-gemini", route => {
    calls++;
    if (status === "network") return route.abort("failed");
    if (status === "local_limit") return route.fulfill({ status: 429, json: { detail: "Request limit reached" } });
    return route.fulfill({ json: { status } });
  });
  await page.goto("/owner/ai-settings");
  await page.getByRole("button", { name: "Test Gemini connection", exact: true }).click();
  const feedback = page.locator("#gemini-connection-feedback [role=alert]");
  await expect(feedback).toContainText(message);
  await expect(feedback).toBeInViewport();
  await expect(page.getByRole("button", { name: "Test Gemini connection", exact: true })).toBeEnabled();
  expect(calls).toBe(1);
});

test("Gemini displays loading immediately and blocks duplicate clicks", async ({ page }) => {
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: {
    ...testAISettings, gemini_available: true,
  } }));
  let calls = 0;
  let release: (() => void) | undefined;
  await page.route("**/api/owner/ai-settings/test-gemini", async route => {
    calls++;
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { status: "connected" } });
  });
  await page.goto("/owner/ai-settings");
  await page.getByRole("button", { name: "Test Gemini connection", exact: true }).click();
  const button = page.getByRole("button", { name: "Testing Gemini connection...", exact: true });
  await expect(button).toBeDisabled();
  await expect(page.locator("#gemini-connection-feedback")).toContainText("Testing Gemini connection...");
  await button.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
  await expect.poll(() => Boolean(release)).toBe(true);
  expect(calls).toBe(1);
  release?.();
  await expect(page.locator("#gemini-connection-feedback")).toContainText("Gemini connection successful");
  await expect(page.locator("#gemini-connection-feedback")).toBeInViewport();
});


test("Gemini client deadline gives visible timeout feedback", async ({ page }) => {
  await page.addInitScript(() => {
    AbortSignal.timeout = () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 200);
      return controller.signal;
    };
  });
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: {
    ...testAISettings, gemini_available: true,
  } }));
  await page.route("**/api/owner/ai-settings/test-gemini", () => {});
  await page.goto("/owner/ai-settings");
  await page.getByRole("button", { name: "Test Gemini connection", exact: true }).click();
  await expect(page.locator("#gemini-connection-feedback [role=alert]")).toContainText("request timed out");
  await expect(page.getByRole("button", { name: "Test Gemini connection", exact: true })).toBeEnabled();
});


test("owner sees the selected model and persisted failed test without generation", async ({ page }) => {
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: {
    ...testAISettings, gemini_available: true, gemini_model: "gemini-3.1-flash-lite",
    gemini_last_test_status: "request_rejected", gemini_last_test_at: "2026-11-10T10:00:00Z",
  } }));
  let calls = 0;
  await page.route("**/api/owner/ai-settings/test-gemini", route => {
    calls++; return route.fulfill({ json: { status: "connected", model: "gemini-3.1-flash-lite" } });
  });
  await page.goto("/owner/ai-settings");
  await expect(page.getByText("gemini-3.1-flash-lite", { exact: false })).toBeVisible();
  await expect(page.getByText("Last synthetic test: request_rejected", { exact: false })).toBeVisible();
  expect(calls).toBe(0);
});


test("owner diagnostics distinguish pacing, quota, timeout, and daily budget", async ({ page }) => {
  await page.route("**/api/owner/ai-settings", route => route.fulfill({ json: {
    ...testAISettings, gemini_diagnostics: [
      { operation: "pacing", reason: "budget_minute", count: 2 },
      { operation: "evaluation", reason: "quota", count: 4 },
      { operation: "question", reason: "timeout", count: 1 },
      { operation: "evaluation", reason: "budget_daily", count: 1 },
    ],
  } }));
  await page.goto("/owner/ai-settings");
  await expect(page.getByRole("heading", { name: "Recent AI pacing and fallback" })).toBeVisible();
  await expect(page.getByText("evaluation: Gemini quota exhausted or rate limited (4)")).toBeVisible();
  await expect(page.getByText("pacing: Local AI pacing limit; wait before submitting (2)")).toBeVisible();
  await expect(page.getByText("question: Gemini response timed out (1)")).toBeVisible();
  await expect(page.getByText("evaluation: Daily AI practice budget reached (1)")).toBeVisible();
});
